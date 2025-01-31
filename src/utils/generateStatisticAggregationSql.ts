import { sql } from 'drizzle-orm';
import * as schema from '../database/schema';

/**
 * Generates an SQL aggregation query for retrieving statistics based on the specified parameters.
 *
 * @param {boolean} isHistory - Indicates whether to use the history table.
 * @param {'effort_in_minutes' | 'assignments'} dataColumn - The data column to aggregate.
 * @param {'month' | 'year'} [timeframe] - The timeframe for the aggregation (optional).
 * @returns {string} The generated SQL aggregation query.
 */
export const generateStatisticAggregationSql = (
  isHistory: boolean,
  dataColumn: 'effort_in_minutes' | 'assignments',
  timeframe?: 'month' | 'year',
) => {
  // Determine the appropriate table based on the parameters
  const table = isHistory
    ? 'history'
    : dataColumn === 'effort_in_minutes'
      ? 'doings'
      : 'assignments';

  // Construct the SQL condition for the specified timeframe
  let timeframeCondition;
  switch (timeframe) {
    case 'month':
      timeframeCondition = sql`strftime('%Y-%m', datetime(${schema[table].updated_at}, 'unixepoch')) = strftime('%Y-%m', 'now')`;
      break;
    case 'year':
      timeframeCondition = sql`strftime('%Y', datetime(${schema[table].updated_at}, 'unixepoch')) = strftime('%Y', 'now')`;
      break;
    default:
      timeframeCondition = sql`1 = 1`;
  }

  // Return the appropriate SQL aggregation based on the data column
  return dataColumn === 'effort_in_minutes' &&
    (table === 'doings' || table === 'history')
    ? sql`sum(${schema[table].effort_in_minutes}) FILTER (WHERE ${timeframeCondition})`
    : sql`count(${schema[table].id}) FILTER (WHERE ${timeframeCondition})`;
};
