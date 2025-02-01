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
  metric: 'effort_in_minutes' | 'assignments',
  timeframe?: 'week' | 'month' | 'year',
) => {
  // Determine the appropriate tables based on the parameters
  const dataTable = isHistory
    ? 'history'
    : metric === 'effort_in_minutes'
      ? 'doings'
      : 'assignments';
  const timeConsstraintTable = isHistory ? 'history' : 'assignments';

  // Construct the SQL condition for the specified timeframe
  let timeframeCondition;
  switch (timeframe) {
    case 'week':
      timeframeCondition = sql`strftime('%Y-%W', datetime(${schema[timeConsstraintTable].updated_at}, 'unixepoch')) = strftime('%Y-%W', 'now')`;
      break;
    case 'month':
      timeframeCondition = sql`strftime('%Y-%m', datetime(${schema[timeConsstraintTable].updated_at}, 'unixepoch')) = strftime('%Y-%m', 'now')`;
      break;
    case 'year':
      timeframeCondition = sql`strftime('%Y', datetime(${schema[timeConsstraintTable].updated_at}, 'unixepoch')) = strftime('%Y', 'now')`;
      break;
    default:
      timeframeCondition = sql`1 = 1`;
  }

  // Return the appropriate SQL aggregation based on the data column
  if (metric === 'effort_in_minutes') {
    if (dataTable === 'assignments') {
      throw new Error('Effort aggregation is not supported for assignments');
    }
    // Sum the effort in minutes
    return sql`sum(${schema[dataTable].effort_in_minutes}) FILTER (WHERE ${timeframeCondition})`;
  } else {
    // Count the number of assignments
    return sql`count(${schema[dataTable].id}) FILTER (WHERE ${timeframeCondition})`;
  }
};
