import { Elysia, t } from 'elysia';
import { getDbConnection } from '../database/db';
import * as Helpers from '../utils/helpers';
import * as schema from '../database/schema';
import { sql, and, eq, type SQL } from 'drizzle-orm';

const siriRoutes = new Elysia().group('/siri', (siriGroup) =>
  siriGroup.get(
    '/todos',
    async (ctx: any) => {
      const apiKey = ctx.headers['x-api-key'];

      try {
        const { userName } = ctx.query;

        const db = getDbConnection(
          await Helpers.getAndValidateDbGroupFromApiKey(apiKey),
        );

        // Optional filter by userName
        let userNameFilter: SQL;
        if (userName) {
          userNameFilter = eq(schema.users.username, userName);
        } else {
          userNameFilter = sql`1 = 1`;
        }

        const assignmentsQuery = db
          .select({
            doingName: schema.doings.name,
            //username: schema.users.username,
          })
          .from(schema.assignments)
          .innerJoin(
            schema.doings,
            eq(schema.assignments.doing_id, schema.doings.id),
          )
          .innerJoin(
            schema.users,
            eq(schema.assignments.user_id, schema.users.id),
          )
          .where(and(userNameFilter, eq(schema.assignments.status, 'pending')));

        const assignments = await assignmentsQuery;

        if (assignments.length === 0) {
          if (userName) {
            return `Hallo ${userName}. Du hast alles erledigt. Gute Arbeit!`;
          }
          return 'Es sind keine Aufgaben mehr offen. Gute Arbeit!';
        }

        if (userName) {
          return `Hallo ${userName}. Du hast diese Woche noch ${assignments.length} offene Aufgaben. ${assignments.map((assignment) => assignment.doingName).join(', ')}.`;
        }
        return `Diese Woche sind noch ${assignments.length} Aufgaben offen. ${assignments.map((assignment) => assignment.doingName).join(', ')}.`;
      } catch (error) {
        console.error(error);
        return 'Leider ist ein Fehler beim Abrufen der Aufgaben aufgetreten.';
      }
    },
    {
      headers: t.Object({
        'x-api-key': t.String(),
      }),
      query: t.Object({
        userName: t.Optional(t.String()),
      }),
      response: t.String(),
    },
  ),
);

export default siriRoutes;
