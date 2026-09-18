import { z } from "zod";

/** A Discord snowflake id. */
export const snowflakeSchema = z.string().regex(/^\d{17,20}$/, "Invalid Discord id");
export const nullableSnowflakeSchema = snowflakeSchema.nullable();
