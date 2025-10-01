import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function openDB() {
  return open({
    filename: "./tunepath-backend/tunepath.db", // ruta de tu base de datos
    driver: sqlite3.Database
  });
}
