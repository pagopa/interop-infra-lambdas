export REDSHIFT_CLUSTER_IDENTIFIER="interop-analytics-dev" 
export REDSHIFT_DATABASE_NAME="interop_dev" 
export REDSHIFT_DB_USER="dev_mv_refresher_user"  

export VIEWS_SCHEMAS_NAMES="[\"views\", \"sub_views\"]"
export PROCEDURES_SCHEMA="sub_views"

npm run run-local

