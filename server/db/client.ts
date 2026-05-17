import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import * as schema from './schema'

const defaultDatabasePath = resolve(process.cwd(), 'data/sqlite.db')
const databaseUrlPrefix = 'file:'

const createClient = (database: Database.Database) => drizzle(database, { schema })

let sqlite: Database.Database | undefined
let db: ReturnType<typeof createClient> | undefined

export function getDatabasePath() {
  const configuredPath = process.env.QRCC_DATABASE_URL

  if (!configuredPath) {
    return defaultDatabasePath
  }

  return configuredPath.startsWith(databaseUrlPrefix)
    ? configuredPath.slice(databaseUrlPrefix.length)
    : configuredPath
}

export function getDb() {
  if (!sqlite || !db) {
    const databasePath = getDatabasePath()

    mkdirSync(dirname(databasePath), { recursive: true })
    sqlite = new Database(databasePath)
    sqlite.pragma('foreign_keys = ON')
    db = createClient(sqlite)
  }

  return db
}

export function closeDb() {
  sqlite?.close()
  sqlite = undefined
  db = undefined
}

export type DatabaseClient = ReturnType<typeof createClient>
