import type { Knex } from "knex";
import { createLogger, type LoggerType } from "./utils/logger";
import { createDatabase, type DatabaseType } from "./db/db";
import { createNotification, type NotificationType } from "./utils/notification";
import { createMail, type MailType } from "./utils/mail";

export type { LoggerType, DatabaseType, NotificationType, MailType };

export interface AppContext {
  knex: Knex;
  database: DatabaseType;
  logger: LoggerType;
  notification: NotificationType;
  mail: MailType;
}

let _context: AppContext | null = null;

export function createContext(): AppContext {
  if (_context) {
    return _context;
  }

  const logger = createLogger();
  const database = createDatabase(logger);
  const knex = database.instance;
  const notification = createNotification(knex, logger);
  const mail = createMail(logger);

  _context = {
    knex,
    database,
    logger,
    notification,
    mail,
  };

  return _context;
}

export function getContext(): AppContext {
  if (!_context) {
    return createContext();
  }
  return _context;
}

export function resetContext(): void {
  _context = null;
}
