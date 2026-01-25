import knex, { Knex } from "knex";
import knexConfig from "./knexfile";
import type { LoggerType } from "../logger";

export interface PaginationOptions {
  perPage?: number;
  currentPage?: number;
  isLengthAware?: boolean;
}

export interface PaginationResult<T = unknown> {
  data: T[];
  pagination: {
    perPage: number;
    currentPage: number;
    from: number;
    to: number;
    total?: number;
    lastPage?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

declare module "knex" {
  namespace Knex {
    interface QueryBuilder {
      paginate(options?: PaginationOptions): Promise<PaginationResult>;
    }
  }
}

let _db: Knex | null = null;

function attachPaginate(knexModule: typeof import("knex")) {
  async function paginate(
    this: Knex.QueryBuilder,
    { perPage = 10, currentPage = 1, isLengthAware = false }: PaginationOptions = {},
  ): Promise<PaginationResult> {
    perPage = Math.max(1, Math.floor(perPage));
    currentPage = Math.max(1, Math.floor(currentPage));

    const offset = (currentPage - 1) * perPage;

    const data = await this.clone().offset(offset).limit(perPage);

    const pagination: PaginationResult["pagination"] = {
      perPage,
      currentPage,
      from: offset + 1,
      to: offset + data.length,
      hasNext: data.length === perPage,
      hasPrev: currentPage > 1,
    };

    if (isLengthAware) {
      const countQuery = this.clone().clearSelect().clearOrder().count("* as total").first();
      const countResult = await countQuery;
      const total = +((countResult as any)?.total || 0);

      pagination.total = total;
      pagination.lastPage = Math.ceil(total / perPage);
      pagination.hasNext = currentPage < pagination.lastPage;
    }

    return { data, pagination };
  }

  try {
    (knexModule as any).QueryBuilder.extend("paginate", paginate);
  } catch (error: unknown) {
    console.error("Error attaching paginate method to Knex QueryBuilder:", error);
  }
}

function createKnexInstance(): Knex {
  if (_db) {
    return _db;
  }
  attachPaginate(knex);
  _db = knex(knexConfig);
  return _db;
}

export interface DatabaseType {
  instance: Knex;
  init: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createDatabase(logger: LoggerType): DatabaseType {
  const knexInstance = createKnexInstance();

  async function init(): Promise<void> {
    try {
      await knexInstance.migrate.latest();
      logger.info("Database connection established and migrations applied!");
    } catch (error) {
      logger.error("Database initialization failed!");
      console.error(error);
      throw error;
    }
  }

  async function stop(): Promise<void> {
    if (_db) {
      await _db.destroy();
      _db = null;
      logger.info("Database connection closed!");
    }
  }

  return {
    instance: knexInstance,
    init,
    stop,
  };
}

export const db = createKnexInstance();
