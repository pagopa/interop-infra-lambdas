import { RedshiftClient, DescribeClustersCommand, Cluster } from "@aws-sdk/client-redshift";
import { assertNotEmptyAndTrim } from "./utils";


export class RedshiftClusterChecker {

  #redshift: RedshiftClient;
  #redshiftClusterIdentifier: string;

  constructor( redshiftClusterIdentifier: string | undefined ) {
    this.#redshiftClusterIdentifier = assertNotEmptyAndTrim( redshiftClusterIdentifier, "redshiftClusterIdentifier" );
    this.#redshift = new RedshiftClient({});
  }

  async isAvailable() {
    const command = new DescribeClustersCommand({ ClusterIdentifier: this.#redshiftClusterIdentifier });
    const response = await this.#redshift.send(command);
    
    const cluster: Cluster | undefined = response.Clusters?.[0];

    if( cluster ) {
      console.log(`Cluster ${this.#redshiftClusterIdentifier} has status ${cluster.ClusterStatus}`)
      const clusterAvailable = cluster.ClusterStatus === "available";
      return clusterAvailable;
    }
    else {
      throw new Error(`Cluster ${this.#redshiftClusterIdentifier} do not exists`);
    }
  }

}
