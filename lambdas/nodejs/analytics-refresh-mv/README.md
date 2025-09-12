## Overview

This lambda, when invoked, use RedShift-data-API, to refresh all stale materialized views 
into schemas listed in the `VIEWS_SCHEMAS_NAMES` environment variables. 
The refresh are executed sequentially by _level_, view with the same _level_ are refreshed 
in parallel; the _level_ is defined in the name of the view because __every view name must 
start with__ `mv_NN_` where __NN__ is the view's _level_

This lambda needs some stored procedure because the RedShift user used by this lambda 
is not the materialized views owner.
- list_stale_materialized_views
- refresh_materialized_view
- last_mv_refresh_info

If the redshift cluster is not available the lambda abort materialized views refresh  
without throw error. This feature is needed to do not pollute the alarms during maintenance
windows. The available condition is defined as `cluster.ClusterStatus === "available"` on 
the result of [DescribeClusters API](https://docs.aws.amazon.com/cli/latest/reference/redshift/describe-clusters.html).


## Parameters
This lambda do not get parameters from input event.

All the parameters are read from environment variables:
- `REDSHIFT_CLUSTER_IDENTIFIER` this lambda work on one database of one cluster;
- `REDSHIFT_DATABASE_NAME` the database to connect to;
- `REDSHIFT_DB_USER` database user used for materialized views inspect and refresh;
- `VIEWS_SCHEMAS_NAMES` a json array of strings where each element is a database 
  schema to inspect for stale materialized views.
- `PROCEDURES_SCHEMA` the name of the redshift schema where the procedure are declared.
- `INCREMENTAL_MV_MIN_INTERVAL`, this optional parameter contain the minimum number of seconds 
   between two refresh of the same materialized view. This parameter apply to materialized views 
   that are refreshed incrementally. If not given default value is 0.
- `NOT_INCREMENTAL_MV_MIN_INTERVAL`, this optional parameter contain the minimum number of seconds 
   between two refresh of the same materialized view. This parameter apply to materialized views 
   that are refreshed with full recalculation and materialized views with refresh issues. If not 
   given default value is 0. Technically this parameter is used for every materialized view with 
   `state` field of table [SVV_MV_INFO](https://docs.aws.amazon.com/redshift/latest/dg/r_SVV_MV_INFO.html)
   not equal to 1.

## Algorithm
The used algorithm is:
- Connect to the database using ["redshift-data API"](https://docs.aws.amazon.com/redshift/latest/mgmt/data-api.html)
- List stale materialized views calling stored procedure `list_need_refresh_views` and 
  listing the result with
  ```sql
    SELECT
      mv_schema, mv_name, mv_level,
      incremental_refresh_not_supported, 
      last_refresh_start_time, 
      last_refresh_end_time,
      last_refresh_start_time_epoch,
      last_refresh_end_time_epoch
    FROM
      list_need_refresh_views_results
    ORDER BY
      mv_level asc,
      mv_schema asc,
      mv_name asc
  ```
  The `list_need_refresh_views_results` table is temporary: the two statement must be 
  executed in the same session.
  - The procedure It is based on the naming convention `mv_NN_...` where NN is the 
    _refresh order_: views with lower NN must be refreshed first. 
- Group and sort materialized views by `mv_level` column.
- Execute refresh materialized views calling `refresh_materialized_view` procedure in 
  parallel using node [`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all) function.
- After all refresh, the lambda, call procedure `list_need_refresh_views` to update 
  table `list_need_refresh_views_results` containing refresh timestamps. This table 
  is used by QuickSight dashboards.

## Local execution
Set environment variables values in `.env` file and execute `npm run local`

## Test Testing (mutation testing)
npm run mutation-testing

Mutation reports, and test coverage reports, are saved into `reports/` lambda subfolder.
