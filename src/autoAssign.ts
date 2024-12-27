import { db } from './database/db';
import {
  users,
  doings,
  assignments,
  shitty_points,
  history,
} from './database/schema';
import { eq, and, or, isNull, gt, desc } from 'drizzle-orm';
import { getCalendarWeekFromDateOfCurrentYear } from './helper';

const ENABLE_LOGGING = true;

export class AssignmentService {
  private db;

  constructor() {
    this.db = db;
  }

  // Main method to perform doing assignment
  async assignTasksForWeek(dryRun = false): Promise<void | any[]> {
    const users = await this.getActiveUsers();
    const doings = await this.getQualifiedDoings();
    const shittyPoints = await this.getShittyPoints();
    const todoHistory = await this.getRecentTodoHistory();

    // Step 1: Randomize doing order
    const shuffledDoings = this.shuffleArray(doings);

    // Step 2: Group doings by repetition type
    const doingGroups = this.groupDoingsByRepetition(shuffledDoings);

    // Step 3: Assign doings in batches by repetition type
    const assignments = [];
    for (const repetition in doingGroups) {
      const group = doingGroups[repetition];
      const groupAssignments = this.optimizeAssignments(
        group,
        users,
        shittyPoints,
        todoHistory,
      );
      assignments.push(...groupAssignments);
    }

    // Step 4: Save assignments to the database
    await this.saveAssignments(assignments, dryRun);
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
    // - either one of the following:
    //   - it was never assigned before (no history entry)
    //   - its repetition is daily or weekly
    //   - its repetition is monthly and the last assignment was more than 30 days ago
    //   - its repetition is yearly and the last assignment was more than 365 days ago
    //   - the last assignment was postponed or failed

    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const oneYearAgo = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const qualifiedDoings = await this.db
      .select()
      .from(doings)
      .where(
        and(
          isNull(doings.deleted_at),
          eq(doings.is_active, true),
          or(
            isNull(
              this.db
                .select({ id: history.id })
                .from(history)
                .where(eq(history.doing_id, doings.id))
                .limit(1),
            ),
            eq(doings.repetition, 'daily'),
            eq(doings.repetition, 'weekly'),
            and(
              eq(doings.repetition, 'monthly'),
              gt(
                this.db
                  .select({ created_at: history.created_at })
                  .from(history)
                  .where(eq(history.doing_id, doings.id))
                  .orderBy(desc(history.created_at))
                  .limit(1),
                thirtyDaysAgo,
              ),
            ),
            and(
              eq(doings.repetition, 'yearly'),
              gt(
                this.db
                  .select({ created_at: history.created_at })
                  .from(history)
                  .where(eq(history.doing_id, doings.id))
                  .orderBy(desc(history.created_at))
                  .limit(1),
                oneYearAgo,
              ),
            ),
            eq(
              this.db
                .select({ status: history.status })
                .from(history)
                .where(eq(history.doing_id, doings.id))
                .orderBy(desc(history.created_at))
                .limit(1),
              'postponed',
            ),
            eq(
              this.db
                .select({ status: history.status })
                .from(history)
                .where(eq(history.doing_id, doings.id))
                .orderBy(desc(history.created_at))
                .limit(1),
              'failed',
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
        const group = doing.repetition;
        if (!groups[group]) groups[group] = [];
        groups[group].push(doing);
        return groups;
      },
      {} as Record<string, any[]>,
    );
  }

  // Core: Optimize task assignments for a batch of doings
  private optimizeAssignments(
    doings: any[],
    users: any[],
    shittyPoints: any[],
    todoHistory: any[],
  ): any[] {
    const assignments: any[] = [];

    // Create a scoring matrix for doings and users
    const scores = this.calculateScores(
      doings,
      users,
      shittyPoints,
      todoHistory,
    );

    // Optimize assignment using a simple greedy approach
    doings.forEach((doing) => {
      const bestUser = this.selectBestUser(doing, scores, assignments, users);
      if (bestUser) {
        assignments.push({ doing, user: bestUser });
        if (ENABLE_LOGGING) {
          console.log(`Assigned doing ${doing.id} to user ${bestUser.id}`);
          console.log('---');
        }
      }
    });

    return assignments;
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
      users.forEach((user) => {
        let score = 0;

        // Penalize based on shitty points
        const shittyPoint = shittyPoints.find(
          (sp) => sp.doing_id === doing.id && sp.user_id === user.id,
        );
        if (shittyPoint) {
          score -= shittyPoint.points;
          if (ENABLE_LOGGING) {
            console.log(
              `Penalized ${shittyPoint.points} points for user ${user.id} on doing ${doing.id} due to shitty points`,
            );
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
            console.log(
              `Penalized ${recencyPenalty} points for user ${user.id} on doing ${doing.id} due to recent completion`,
            );
          }
        });

        // Add points if the user skipped, postponed, or failed the last time
        const lastHistoryEntry = todoHistory.find(
          (h) => h.doing_id === doing.id && h.user_id === user.id,
        );
        if (
          lastHistoryEntry &&
          ['skipped', 'postponed', 'failed'].includes(lastHistoryEntry.status)
        ) {
          score += 50;
          if (ENABLE_LOGGING) {
            console.log(
              `Added 50 points for user ${user.id} on doing ${doing.id} due to last status being ${lastHistoryEntry.status}`,
            );
          }
        }

        // Add score to the map
        scores.set(`${doing.id}-${user.id}`, score);
      });
    });

    return scores;
  }

  // Helper: Select the best user for a given doing
  private selectBestUser(
    doing: any,
    scores: Map<string, number>,
    assignments: any[],
    users: any[],
  ) {
    const eligibleUsers = users.filter((user) => {
      // Apply fairness constraints (e.g., workload balance)

      // get total effort of assignments assigned to this user in the current run
      const userAssignments = assignments.filter((a) => a.user.id === user.id);
      const totalEffort = userAssignments.reduce(
        (sum, a) =>
          sum + a.doing.effort_in_minutes * (a.doing.days_per_week ?? 1),
        0,
      );

      return (
        totalEffort <
          (user.participation_percent / 100) *
            this.getTotalEffort(assignments) || totalEffort === 0
      );
    });

    // Find the user with the highest score for this doing
    return eligibleUsers.reduce((bestUser, user) => {
      const score = scores.get(`${doing.id}-${user.id}`) || 0;
      if (ENABLE_LOGGING) {
        console.log(`User ${user.id} has score ${score} for doing ${doing.id}`);
      }
      return !bestUser ||
        score > (scores.get(`${doing.id}-${bestUser.id}`) || 0)
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
      (5 - (daysAgo / 60) * 4) / (historyEntry.days_per_week ?? 1),
    ); // Linearly decay penalty from 5 to 1 over 60 days
  }

  // Helper: Save assignments to the database
  private async saveAssignments(
    assignmentObjects: any[],
    dryRun: boolean,
  ): Promise<void> {
    const assignmentsToSave = assignmentObjects.flatMap((assignment) => {
      const now = new Date();
      const dueWeek = getCalendarWeekFromDateOfCurrentYear(now);

      if (assignment.doing.repetition === 'daily') {
        return Array.from(
          { length: assignment.doing.days_per_week },
          (_, i) => ({
            doing_id: assignment.doing.id,
            user_id: assignment.user.id,
            due_week: dueWeek,
            status: i === 0 ? ('pending' as const) : ('waiting' as const),
            created_at: now,
            updated_at: now,
          }),
        );
      }

      return {
        doing_id: assignment.doing.id,
        user_id: assignment.user.id,
        due_week: dueWeek,
        status: 'pending' as const,
        created_at: now,
        updated_at: now,
      };
    });

    if (dryRun) {
      console.log('Dry run, assignments will not be saved to the database:');
      console.log(assignmentsToSave);
      return;
    }

    await this.db.insert(assignments).values(assignmentsToSave);
  }

  // Helper: Calculate total effort from assignments
  private getTotalEffort(assignments: any[]): number {
    return assignments.reduce(
      (sum, a) =>
        sum + a.doing.effort_in_minutes * (a.doing.days_per_week ?? 1),
      0,
    );
  }
}
