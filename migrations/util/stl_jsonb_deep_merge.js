const mergeFunctionName = 'stl_jsonb_deep_merge'

function mergeFunction (schema) {
  // PostgreSQL || operator or Objection.js `patch` do not perform deep merge so we need
  // a custom function to PATCH a JSON in an isolated way rather than performing JS logic
  // on DB snapshot, which was breaking concurrent requests on different fields
  // .e.g.
  // object { a: true } => PATCH 1 { b: 'something important' }
  // object { a: true } => PATCH 2 { a: false } /* starting before PATCH 1 ends but finishing last */
  // gives { a: false }, PATCH 1 being lost…

  // Implemented algorithm is similar to a recursive version of JavaScript Object.assign
  // Note that:
  // 1. we overwrite array with any new value (array or not) rather than implicitly merging values
  // 2. Null value applied to any key in second argument overwrites previous value in first arg
  //    Note that PostgreSQL NULL value is not the same as jsonb 'null'
  //
  // Reference:
  // - Inspiring contributions: https://stackoverflow.com/questions/42944888/merging-jsonb-values-in-postgresql
  // - https://www.postgresql.org/docs/9.6/sql-createfunction.html
  //
  // We might introduce a third argument to define how we handle arrays.
  //
  // a: Previous object value, b: 'patch' object (only including keys to update)
  return `CREATE OR REPLACE FUNCTION ${mergeFunctionName}(base jsonb, patch jsonb)
    RETURNS jsonb
    LANGUAGE sql
    IMMUTABLE
    AS $$
    SELECT (
      CASE
        /* If one of merge arguments is not an object, then right-hand side overwrites left-hand side
        * Else we proceed with recursive merge
        * This check is needed before using jsonb_each
        * Playing with this fiddle may help: http://sqlfiddle.com/#!17/00c96/1
        */
        WHEN patch IS NULL THEN base -- Resetting to SQL NULL is not allowed
        WHEN jsonb_typeof(base) <> 'object' OR jsonb_typeof(patch) <> 'object' THEN patch
        ELSE (
          SELECT jsonb_object_agg(
            COALESCE(base_key, patch_key),
            CASE
              WHEN base_val IS NULL THEN patch_val
              WHEN patch_val IS NULL THEN base_val
              WHEN jsonb_typeof(base_val) <> 'object' OR jsonb_typeof(patch_val) <> 'object' THEN patch_val
              ELSE ${schema}.${mergeFunctionName}(base_val, patch_val)
            END
          )
          FROM jsonb_each(base) AS lines_base(base_key, base_val)
          FULL JOIN jsonb_each(patch) AS lines_patch(patch_key, patch_val) ON base_key = patch_key
        )
      END
    )::jsonb
    $$;
  `
}

module.exports = {
  mergeFunctionName,
  mergeFunction
}
