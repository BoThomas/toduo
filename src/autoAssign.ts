import { getDbConnection } from './database/db';
import {
  users,
  doings,
  assignments,
  shitty_points,
  history,
} from './database/schema';
import {
  eq,
  and,
  or,
  isNull,
  gt,
  lte,
  desc,
  inArray,
  count,
  sum,
  sql,
} from 'drizzle-orm';

const ENABLE_LOGGING = true;

type Assignment = {
  doing: any;
  user: any;
};

export class AssignmentService {
  private db;

  constructor(group: string) {
    this.db = getDbConnection(group);
  }

  // Main method to perform doing assignment
  async assignTasksForWeek(options?: {
    dryRun?: boolean; // If true, will not touch current assignments, skip pre-assignment operations, and log assignments instead of saving them
    clearAndReassign?: boolean; // If true, will clear all current assignments and reassign without evaluation
    groupByRepetition?: boolean; // If true, will group doings by repetition type and assign in batches
  }): Promise<void | any[]> {
    const {
      dryRun = false,
      clearAndReassign = false,
      groupByRepetition = false,
    } = options || {};

    if (ENABLE_LOGGING) {
      console.log(
        `\n--- Autoassign Starting ---\nDry Run: ${dryRun}\nClear and Reassign: ${clearAndReassign}\nGroup by Repetition: ${groupByRepetition}\n---------------------------`,
      );
    }

    // Step 0: Pre-assignment operations
    if (!dryRun && !clearAndReassign) {
      await this.deactivateCompletedOnceDoings();
      await this.changePendingAndWaitingAssignmentsToFailed();
      await this.moveCurrentAssignmentsToHistory();
      await this.correctNegativeShittyPoints();
    }

    if (clearAndReassign) {
      // Clear all current assignments
      await this.db.delete(assignments);
    }

    const users = await this.getActiveUsers();
    const doings = await this.getQualifiedDoings();
    const shittyPoints = await this.getShittyPoints();
    const todoHistory = await this.getRecentTodoHistory();
    const totalEffort = this.getTotalEffort(doings);

    // Step 1: Extract static assigned doings and randomize the rest
    const staticDoings = doings.filter(
      (doing) => doing.static_user_id !== null,
    );
    const dnymaicDoings = doings.filter(
      (doing) => doing.static_user_id === null,
    );
    const shuffledDynamicDoings = this.shuffleArray(dnymaicDoings);

    // Step 2: Group dynamic doings by repetition type
    let dynamicDoingGroups;
    if (groupByRepetition) {
      dynamicDoingGroups = this.groupDoingsByRepetition(shuffledDynamicDoings);
    } else {
      dynamicDoingGroups = { default: shuffledDynamicDoings };
    }

    // Step 3: Assign static doings
    const assignmentArray: Assignment[] = [];
    if (ENABLE_LOGGING) {
      console.log('\n--- Create Static Assignments ---');
    }
    this.addStaticAssignments(assignmentArray, staticDoings, users);

    // Step 4: Assign doings in batches by repetition type
    if (ENABLE_LOGGING) {
      console.log('\n--- Create Dynamic Assignments ---');
    }
    for (const repetition in dynamicDoingGroups) {
      const group = dynamicDoingGroups[repetition];
      this.addDynamicAssignments(
        assignmentArray,
        group,
        users,
        shittyPoints,
        todoHistory,
        totalEffort,
      );
    }

    // Step 4: Save assignments to the database
    await this.saveAssignments(assignmentArray, dryRun);
  }

  // PreHelper: Deactivate completed "once" doings
  private async deactivateCompletedOnceDoings() {
    // select assignments with doings of interval_unit once, that are completed
    const currentlyCompletedOnceDoingIds = await this.db
      .select({ id: doings.id })
      .from(assignments)
      .leftJoin(doings, eq(doings.id, assignments.doing_id))
      .where(
        and(
          eq(doings.interval_unit, 'once'),
          eq(assignments.status, 'completed'),
        ),
      );

    // deactivate doings with ids from the above query
    if (currentlyCompletedOnceDoingIds.length === 0) {
      return;
    }
    await this.db
      .update(doings)
      .set({ is_active: false })
      .where(
        inArray(
          doings.id,
          currentlyCompletedOnceDoingIds
            .map((doing: any) => doing.id)
            .filter((id: any) => id !== null),
        ),
      );
  }

  // PreHelper: Change pending and waiting assignments to failed
  private async changePendingAndWaitingAssignmentsToFailed() {
    await this.db
      .update(assignments)
      .set({ status: 'failed' })
      .where(
        or(
          eq(assignments.status, 'pending'),
          eq(assignments.status, 'waiting'),
        ),
      );
  }

  // PreHelper: Move current assignments to history
  private async moveCurrentAssignmentsToHistory() {
    const currentAssignments = await this.db
      .select({
        doing_id: assignments.doing_id,
        user_id: assignments.user_id,
        interval_unit: doings.interval_unit,
        interval_value: doings.interval_value,
        repeats_per_week: doings.repeats_per_week,
        effort_in_minutes: doings.effort_in_minutes,
        status: assignments.status,
        created_at: assignments.created_at,
        updated_at: assignments.updated_at,
      })
      .from(assignments)
      .leftJoin(doings, eq(doings.id, assignments.doing_id));

    if (currentAssignments.length === 0) {
      return;
    }

    await this.db.insert(history).values(currentAssignments);
    await this.db.delete(assignments);
  }

  // PreHelper: Correct negative shitty points
  private async correctNegativeShittyPoints() {
    if (ENABLE_LOGGING) {
      console.log('Starting correction of negative shitty points');
    }

    // get the sum of all doings that are not deleted
    const sumOfAllDoings = await this.db
      .select({
        totalDoings: count(),
      })
      .from(doings)
      .where(isNull(doings.deleted_at));

    if (ENABLE_LOGGING) {
      console.log('Total doings:', sumOfAllDoings[0].totalDoings);
    }

    // get the sum of shitty points for each user
    const shittyPointsUnserSums = await this.db
      .select({
        user_id: shitty_points.user_id,
        shittyPointsSum: sum(shitty_points.points),
      })
      .from(shitty_points)
      .groupBy(shitty_points.user_id);

    if (ENABLE_LOGGING) {
      console.log('Sum of shitty points for each user:', shittyPointsUnserSums);
    }

    // loop through each users sum of shitty points and correct if necessary
    for (const user of shittyPointsUnserSums) {
      const availablePoints =
        sumOfAllDoings[0].totalDoings - Number(user.shittyPointsSum ?? 0);

      if (ENABLE_LOGGING) {
        console.log(
          `User ${user.user_id} - Available points: ${availablePoints}`,
        );
      }

      // if the users available shitty points are greater than or equal to 0, everything is fine
      if (availablePoints >= 0) {
        continue;
      }

      // get all shitty points greater than 0 for the user for possible correction
      const shittyPointsToCorrect = await this.db
        .select({
          user_id: shitty_points.user_id,
          doing_id: shitty_points.doing_id,
          points: shitty_points.points,
        })
        .from(shitty_points)
        .where(
          and(
            eq(shitty_points.user_id, user.user_id),
            gt(shitty_points.points, 0),
          ),
        )
        .orderBy(desc(shitty_points.points));

      if (ENABLE_LOGGING) {
        console.log(
          `User ${user.user_id} - Shitty points to correct:`,
          shittyPointsToCorrect,
        );
      }

      // loop through the shitty points and correct them until the available points are greater than or equal to 0
      let pointsToReduce = Math.abs(availablePoints);
      for (const shittyPoint of shittyPointsToCorrect) {
        if (pointsToReduce <= 0) {
          break;
        }

        if (ENABLE_LOGGING) {
          console.log(
            `User ${user.user_id} - Reducing points for doing ${shittyPoint.doing_id} by ${pointsToReduce}`,
          );
        }

        // if the shitty point is less than or equal to the points to reduce, delete the shitty point
        if (shittyPoint.points <= pointsToReduce) {
          await this.db
            .delete(shitty_points)
            .where(
              and(
                eq(shitty_points.user_id, user.user_id),
                eq(shitty_points.doing_id, shittyPoint.doing_id),
              ),
            );
          pointsToReduce -= shittyPoint.points;
        } else {
          // if the shitty point is greater than the points to reduce, reduce the points
          await this.db
            .update(shitty_points)
            .set({ points: shittyPoint.points - pointsToReduce })
            .where(
              and(
                eq(shitty_points.user_id, user.user_id),
                eq(shitty_points.doing_id, shittyPoint.doing_id),
              ),
            );
          pointsToReduce = 0;
        }

        if (ENABLE_LOGGING) {
          console.log(
            `User ${user.user_id} - Remaining points to reduce: ${pointsToReduce}`,
          );
        }
      }
    }

    if (ENABLE_LOGGING) {
      console.log('Completed correction of negative shitty points');
    }
  }

  // Helper: Fetch all active users
  private async getActiveUsers() {
    return this.db.select().from(users).where(isNull(users.deleted_at));
  }

  // Helper: Fetch all doings qualified for assignment in the current week
  private async getQualifiedDoings() {
    // the following makes a doing qualified:
    // - it is active
    // - it is not deleted (no deleted_at)
    // - if autoassignable_from is set, it must be in the past
    // - either one of the following:
    //   - it was never assigned before (no history entry)
    //   - last assignment was more then 7 * interval_value (interval_unit = weekly)
    //     or 30 * interval_value (interval_unit = monthly) days ago
    //   - the last assignment was postponed or failed

    const qualifiedDoings = await this.db
      .select()
      .from(doings)
      .where(
        and(
          isNull(doings.deleted_at),
          eq(doings.is_active, true),
          or(
            isNull(doings.autoassignable_from),
            lte(doings.autoassignable_from, sql`strftime('%s', 'now')`),
          ),
          or(
            isNull(
              this.db
                .select({ id: history.id })
                .from(history)
                .where(eq(history.doing_id, doings.id))
                .limit(1),
            ),
            lte(
              this.db
                .select({ created_at: history.created_at })
                .from(history)
                .where(eq(history.doing_id, doings.id))
                .orderBy(desc(history.created_at))
                .limit(1),
              sql`(${Date.now()} - ${doings.interval_value} *
              (CASE
                WHEN ${doings.interval_unit} = 'weekly' THEN 7
                WHEN ${doings.interval_unit} = 'monthly' THEN 30
                ELSE 1
              END) * 24 * 60 * 60 * 1000 + (6*60*60*1000)) / 1000`,
            ),
            // the last history entry was created 7/30 days ago
            // (plus 6 hours to account for e.g. daylight saving time)
            // (devided by 1000 to convert to seconds, as drizzle-orm does save timestamps in seconds)
            inArray(
              this.db
                .select({ status: history.status })
                .from(history)
                .where(eq(history.doing_id, doings.id))
                .orderBy(desc(history.created_at))
                .limit(1),
              ['failed', 'postponed'],
            ),
          ),
        ),
      );

    return qualifiedDoings;
  }

  // Helper: Fetch shitty points data
  private async getShittyPoints() {
    return this.db.select().from(shitty_points);
  }

  // Helper: Fetch todo history
  private async getRecentTodoHistory() {
    const fourHundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    return this.db
      .select()
      .from(history)
      .where(and(gt(history.created_at, fourHundredDaysAgo)))
      .orderBy(desc(history.created_at));
  }

  // Helper: Randomly shuffle an array
  private shuffleArray(array: any[]): any[] {
    return array
      .map((item) => ({ item, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ item }) => item);
  }

  // Helper: Group doings by their repetition type
  private groupDoingsByRepetition(doings: any[]): Record<string, any[]> {
    return doings.reduce(
      (groups, doing) => {
        const group = doing.interval_unit;
        if (!groups[group]) groups[group] = [];
        groups[group].push(doing);
        return groups;
      },
      {} as Record<string, any[]>,
    );
  }

  // Core: Create assignments for static doings
  private addStaticAssignments(
    assignmentArray: Assignment[],
    doings: any[],
    users: any[],
  ): void {
    doings.forEach((doing) => {
      const user = users.find((u) => u.id === doing.static_user_id);
      if (user) {
        if (ENABLE_LOGGING) {
          console.log(`\n# Static Doing ${doing.id}`);
          console.log(
            `-> assigning static doing ${doing.id} to user ${user.id}`,
          );
        }
        assignmentArray.push({ doing, user });
      } else {
        if (ENABLE_LOGGING) {
          console.log(
            `\n-> WARN: Static user ${doing.static_user_id} of doing ${doing.id}. This doing will not be assigned.\n`,
          );
        }
      }
    });
  }

  // Core: Create optimized assignments for a batch of dynamic doings
  private addDynamicAssignments(
    currentAssignments: Assignment[],
    doings: any[],
    users: any[],
    shittyPoints: any[],
    todoHistory: any[],
    totalEffort: number,
  ): void {
    // Create a scoring matrix for doings and users
    const scores = this.calculateScores(
      doings,
      users,
      shittyPoints,
      todoHistory,
    );

    if (ENABLE_LOGGING) {
      console.log('\n--- Check Scores and Assign ---\n');
    }

    // Optimize assignment using a simple greedy approach
    doings.forEach((doing) => {
      const bestUser = this.selectBestUser(
        doing,
        scores,
        currentAssignments,
        users,
        totalEffort,
      );
      if (bestUser) {
        currentAssignments.push({ doing, user: bestUser });
        if (ENABLE_LOGGING) {
          console.log(`-> Assigned doing ${doing.id} to user ${bestUser.id}\n`);
        }
      } else {
        if (ENABLE_LOGGING) {
          console.log(
            `-> WARN: No best user found for doing ${doing.id}. This doing will not be assigned.\n`,
          );
          // TODO: add a messages table to the db and store such important messages for chron tasks and show them on next visit to the admin.
          // For sync usage via ui, show them in the ui directly
        }
      }
    });
  }

  // Scoring: Calculate scores for doing-user pairs
  private calculateScores(
    doings: any[],
    users: any[],
    shittyPoints: any[],
    todoHistory: any[],
  ): Map<string, number> {
    const scores = new Map();

    doings.forEach((doing) => {
      if (ENABLE_LOGGING) {
        console.log(`\n# Doing ${doing.id}`);
      }

      users.forEach((user) => {
        if (ENABLE_LOGGING) {
          console.log(`## User ${user.id}`);
        }

        let score = 0;

        // Penalize based on shitty points
        const shittyPoint = shittyPoints.find(
          (sp) => sp.doing_id === doing.id && sp.user_id === user.id,
        );
        if (shittyPoint) {
          score -= shittyPoint.points;
          if (ENABLE_LOGGING) {
            console.log(`-${shittyPoint.points} points due to shitty points`);
          }
        }

        // Penalize if the user recently completed the doing
        const recentCompletions = todoHistory.filter(
          (h) =>
            h.status === 'completed' &&
            h.doing_id === doing.id &&
            h.user_id === user.id,
        );
        recentCompletions.forEach((historyEntry) => {
          const recencyPenalty = this.calculateRecencyPenalty(historyEntry);
          score -= recencyPenalty;
          if (ENABLE_LOGGING) {
            console.log(`-${recencyPenalty} points due to recent completion`);
          }
        });

        // Add points if the user postponed, or failed the last time
        const lastHistoryEntry = todoHistory.find(
          (h) => h.doing_id === doing.id && h.user_id === user.id,
        );
        if (
          lastHistoryEntry &&
          ['postponed', 'failed'].includes(lastHistoryEntry.status)
        ) {
          score += 50;
          if (ENABLE_LOGGING) {
            console.log(
              `+50 points due to last status being ${lastHistoryEntry.status}`,
            );
          }
        }

        // Add score to the map
        scores.set(`${doing.id}-${user.id}`, score);
        if (ENABLE_LOGGING) {
          console.log(`= Score ${score}`);
        }
      });
    });

    return scores;
  }

  // Helper: Select the best user for a given doing
  private selectBestUser(
    currentDoing: any,
    scores: Map<string, number>,
    assignments: any[],
    users: any[],
    totalEffort: number,
  ): any {
    const eligibleUsers = users.filter((user) => {
      // Apply fairness constraints (e.g., workload balance)

      // Ensure that users with 0% participation are excluded
      if (user.participation_percent === 0) {
        return false;
      }

      // get total effort of assignments assigned to this user in the current run
      const usersAssignments = assignments.filter((a) => a.user.id === user.id);
      const usersCurrentEffort = usersAssignments.reduce(
        (sum, a) =>
          sum + a.doing.effort_in_minutes * (a.doing.repeats_per_week ?? 1),
        0,
      );

      // Calculate the maximum effort that the user can take
      const userMaxEffort = (user.participation_percent / 100) * totalEffort;

      if (ENABLE_LOGGING) {
        console.log(
          `# Doing ${currentDoing.id} User ${user.id} Current Effort ${usersCurrentEffort} Max Effort ${userMaxEffort}`,
        );
      }

      // Allow assignment if the user has no assignments yet
      // or if their total effort is within their maximum effort
      return usersCurrentEffort === 0 || usersCurrentEffort <= userMaxEffort;
    });

    // Find the user with the highest score for this doing
    return eligibleUsers.reduce((bestUser, user) => {
      const score = scores.get(`${currentDoing.id}-${user.id}`) || 0;
      if (ENABLE_LOGGING) {
        console.log(
          `# Doing ${currentDoing.id} User ${user.id} Score ${score}`,
        );
      }
      return !bestUser ||
        score > (scores.get(`${currentDoing.id}-${bestUser.id}`) || 0)
        ? user
        : bestUser;
    }, null);
  }

  // Helper: Calculate recency penalty
  private calculateRecencyPenalty(historyEntry: any): number {
    const daysAgo =
      (Date.now() - new Date(historyEntry.created_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysAgo > 60) {
      return 0;
    }

    return Math.round(
      (5 - (daysAgo / 60) * 4) / (historyEntry.repeats_per_week ?? 1),
    ); // Linearly decay penalty from 5 to 1 over 60 days
  }

  // Helper: Save assignments to the database
  private async saveAssignments(
    assignmentObjects: any[],
    dryRun: boolean,
  ): Promise<void> {
    const assignmentsToSave = assignmentObjects.flatMap((assignment) => {
      const now = new Date();
      return Array.from(
        { length: assignment.doing.repeats_per_week },
        (_, i) => ({
          doing_id: assignment.doing.id,
          user_id: assignment.user.id,
          status: i === 0 ? ('pending' as const) : ('waiting' as const),
          created_at: now,
          updated_at: now,
        }),
      );
    });

    if (dryRun) {
      console.log(
        '\n--> Dry run, assignments will not be saved to the database:',
      );
      console.log(assignmentsToSave);
      return;
    }

    if (assignmentsToSave.length === 0) {
      console.log('\n--> No assignments to save');
      return;
    }

    await this.db.insert(assignments).values(assignmentsToSave);
  }

  // Helper: Calculate total effort from assignments/doings
  private getTotalEffort(doings: any[]): number {
    return doings.reduce(
      (sum, d) => sum + d.effort_in_minutes * (d.repeats_per_week ?? 1),
      0,
    );
  }
}
