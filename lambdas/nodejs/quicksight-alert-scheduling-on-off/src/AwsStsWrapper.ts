import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export class AwsStsWrapper {

  #accountId: string | undefined

  async getAwsAccountId() {
    if( ! this.#accountId ) {
      this.#accountId = await this.#getAwsAccountIdFromServer();
    }
    return this.#accountId;
  }

  async #getAwsAccountIdFromServer() {
    try {
      console.log(" - Determining AWS Account ID from caller identity...");
      const stsClient = new STSClient({});
    
      const command = new GetCallerIdentityCommand({});
      const response = await stsClient.send(command);
      const accountId = response.Account
      if (!accountId) {
        throw new Error("Account ID not found in STS response. \n" + JSON.stringify(response));
      }
      console.log(`   ... AWS Account ID: ${accountId}`);
      return accountId;
    
    } catch (error) {
      console.error("ERROR: Failed to get AWS Account ID from STS:", error);
      throw error;
    }
  }
}
