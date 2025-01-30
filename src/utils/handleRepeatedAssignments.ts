import { eq, and, asc, inArray } from 'drizzle-orm';
import * as schema from '../database/schema';
import type { Database } from 'bun:sqlite';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

// types
type DB = BunSQLiteDatabase<typeof schema> & { $client: Database };

/**
 * Automatically handles the state transitions of repeated assignments for a given doing.
 *
 * @param {DB} db - The database instance.
 * @param {number} parentDoingId - The ID of the parent doing.
 * @param {string} parentStatus - The new status of the parent doing.
 *
 * @remarks
 * The function performs the following operations based on the parent doing's status:
 * - If the status is 'completed', 'skipped', or 'postponed':
 *   - Checks if there is a pending assignment for the current doing.
 *   - If a pending assignment exists, it does nothing.
 *   - Otherwise, it sets the status of the next waiting assignment to 'pending'.
 * - If the status is 'pending':
 *   - Retrieves all pending assignments for the current doing.
 *   - If there are no pending assignments, it does nothing.
 *   - Otherwise, it sets the status of every pending assignment except the first one to 'waiting'.
 *
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 *
 * @throws Will log an error message if an error occurs during the operation.
 */
export const handleRepeatedAssignments = async (
  db: DB,
  parentDoingId: number,
  parentStatus: string,
): Promise<void> => {
  try {
    if (['completed', 'skipped', 'postponed'].includes(parentStatus)) {
      // the previous doing is updated to completed, skipped or postponed, so the next waiting assignment should be set to pending

      // check if there is a pending assignment for the current doing
      const pendingAssignment = await db
        .select({
          id: schema.assignments.id,
        })
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.doing_id, parentDoingId),
            eq(schema.assignments.status, 'pending'),
          ),
        )
        .limit(1);

      // If there is a pending assignment, do not change the status of the next waiting assignment
      if (pendingAssignment.length > 0) {
        return;
      }

      // get the next waiting assignment for the current doing
      const nextWaitingAssignment = await db
        .select({
          id: schema.assignments.id,
        })
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.doing_id, parentDoingId),
            eq(schema.assignments.status, 'waiting'),
          ),
        )
        .orderBy(asc(schema.assignments.id))
        .limit(1);

      // If there is no next waiting assignment, do nothing
      if (nextWaitingAssignment.length === 0) {
        return;
      }

      // Set the status of the next waiting assignment to pending
      await db
        .update(schema.assignments)
        .set({
          status: 'pending',
          updated_at: new Date(),
        })
        .where(eq(schema.assignments.id, nextWaitingAssignment[0].id));
    } else if (parentStatus === 'pending') {
      // the previous doing is reverted to pending, so all pending assignments except the first one should be set to waiting

      // Get all pending assignments for the current doing
      const pendingAssignments = await db
        .select({
          id: schema.assignments.id,
        })
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.doing_id, parentDoingId),
            eq(schema.assignments.status, 'pending'),
          ),
        )
        .orderBy(asc(schema.assignments.id));

      // If there are no pending assignments, do nothing
      if (pendingAssignments.length === 0) {
        return;
      }

      // Set the status of every pending assignment except the first one to waiting
      await db
        .update(schema.assignments)
        .set({
          status: 'waiting',
          updated_at: new Date(),
        })
        .where(
          inArray(
            schema.assignments.id,
            pendingAssignments.slice(1).map((a: any) => a.id), // Skip the first pending assignment
          ),
        );
    }
  } catch (error) {
    console.error(
      'Error during auto handling of repeated assignments states for same doing. Skipping this step.',
      error,
    );
  }
};
