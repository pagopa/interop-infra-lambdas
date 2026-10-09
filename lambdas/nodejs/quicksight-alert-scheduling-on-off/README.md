## Overview

This lambda activate or deactivate QuickSight SPICE dataset refresh scheduling.
It is needed because every night and every weekend the redshift cluster is paused 
and we want avoid dataset errors.

Main points:
 - The dataset refresh schedule is not handled directly by IaC (es terraform) 
   the Iac tool only define tags describing schedule parameters
 - This lambda runs when redshift cluster pause/resume look for every SPICE dataset with
   required tags and remove/create refresh schedule.

## Dataset tags
 - `RefreshType`: if a QuickSight SPICE dataset has this tag that dataset is manipulated 
   by ths lambda. It can assume the values ('FULL_REFRESH', 'INCREMENTAL_REFRESH') of the 
   RefreshType attribute [described in the AWS documentation](https://docs.aws.amazon.com/cli/latest/reference/quicksight/create-refresh-schedule.html).
   If 'INCREMENTAL_REFRESH' is required the dataset must have _loopback window_ properties 
   configured via IaC. Terraform example:
   ```
    resource "aws_quicksight_data_set" "fake_call_prevision_data" {
      [...]

      refresh_properties {
        refresh_configuration {
          incremental_refresh {
            lookback_window {
              column_name = "date"
              size_unit   = "DAY"
              size        = 5
            }
          }
        }
      }

      [...]
    }
   ```
 - `RefreshInterval`: optional parameter, support the values `MINUTE15`, `MINUTE30`, `HOURLY`, `DAILY`
   (described in AWS documentation](https://docs.aws.amazon.com/cli/latest/reference/quicksight/create-refresh-schedule.html).
   - `MINUTE15` is the default when `RefreshType` is `INCREMENTAL_REFRESH` and `HOURLY` is the 
     default when `RefreshType` is `FULL_REFRESH`.
   - Values `MINUTE15`, `MINUTE30` are not supported if `RefreshType` is `FULL_REFRESH`.
   - If `RefreshType` is `FULL_REFRESH` then `RefreshInterval` can be valorized with:
     - `WEEKLY_MONDAY`, `WEEKLY_THURSDAY`, `WEEKLY_TUESDAY`, `WEEKLY_WEDNESDAY`, `WEEKLY_FRIDAY` 
       for refresh once a week in the specified day.
     - `WEEKLY_SUNDAY` and `WEEKLY_SATURDAY` are supported but discouraged because analytics is
       stopped for cost-saving reason.
     - `MONTHLY_<NN>` where `<NN>` is a number between 1 and 28 for refresh once a month in the
       specified day.
 - It is possible to define up to 5 schedule defining tags pairs `RefreshType_2`, 
   `RefreshInterval_2` for the second schedule, `RefreshType_3`, `RefreshInterval_3` for 
   the 3rd schedule, etc .... until `RefreshType_5`, `RefreshInterval_5`.

## Input Events
This lambda, for each received event, look for an array field _Records_ and analyze each 
element looking for a redshift event wrapped in an SNS message ([Raw delivery](https://docs.aws.amazon.com/sns/latest/dg/sns-large-payload-raw-message-delivery.html) is not supported on lambda). 
 - This lambda throw an error if do not find any recognizable redshift event. 
 - The class `src/RedshiftSnsEventDecoder.ts` convert any redshift event in an action, possibly none (`null`), 
   if more than one event is mapped to an action the last one in the `Records` array will be used.
   Currently the mapped events are:
   - __REDSHIFT-EVENT-3622__ (Resume Succeeded): mapped to _ON_ action (create schedule)
   - __REDSHIFT-EVENT-3618__ (Pause Started): mapped to _OFF_ action (delete schedule)

Example of events are kept in this repository:
 - __REDSHIFT-EVENT-3622__ (_ON_) [redshift_resume_event.json](./example_redshift_events/redshift_resume_event.json)
 - __REDSHIFT-EVENT-3618__ (_OFF_) [redshift_pause_event.json](./example_redshift_events/redshift_pause_event.json)

## Environment Variables
- `REFRESH_TYPE_TAG_PREFIX` (`RefreshType` by default) and `REFRESH_INTERVAL_TAG_PREFIX` 
  (`RefreshInterval` by default) are the two environment variables who define the names 
  of the QuickSight DataSet tags who contains the schedule informations.
- `MIN_REFRESH_SCHEDULE_OFFSET_SECS` and `MAX_REFRESH_SCHEDULE_OFFSET_SECS` define a time
  range from lambda execution time that will be used as scheduling start time. This is usefull
  to avoid refresh congestion and avoid daily schedule to be ignored by quicksight.
  Defaults are 300 and 900 seconds (5 - 15 minutes).
