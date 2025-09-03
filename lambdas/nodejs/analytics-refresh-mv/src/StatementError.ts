import { DescribeStatementCommandOutput } from '@aws-sdk/client-redshift-data';

export class StatementError extends Error {

  #_info: DescribeStatementCommandOutput;

  constructor(msg: string, info: DescribeStatementCommandOutput) {
    super(msg)
    this.#_info = info;
  }

  toString() {
    return super.toString() + "\n" + JSON.stringify( this.#_info, null, 2 );
  }
}

