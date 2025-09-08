import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedshiftClusterChecker } from '../../src/RedshiftClusterChecker';
import { RedshiftClient, DescribeClustersCommand } from '@aws-sdk/client-redshift';

// --- Mocks Setup ---

// We spy on console.error to ensure it's called without polluting test logs.
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock the entire AWS SDK Redshift client module.
// This allows us to control the behavior of the RedshiftClient and its 'send' method.
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-redshift', () => {
  // We mock the constructor of RedshiftClient to return an object
  // containing our mock 'send' function.
  const RedshiftClient = vi.fn().mockImplementation(() => ({
    send: mockSend,
  }));
  // We also mock the command class, as it's imported by the class under test.
  const DescribeClustersCommand = vi.fn();
  return { RedshiftClient, DescribeClustersCommand };
});


// --- Test Suite ---

describe('RedshiftClusterChecker', () => {
  const CLUSTER_IDENTIFIER = 'my-test-cluster';

  // Reset mocks before each test to ensure test isolation
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Constructor Tests ---
  
  describe('constructor', () => {
    it('should throw an error if redshiftClusterIdentifier is undefined', () => {
      // The mocked assertNotEmptyAndTrim will throw the error.
      expect(() => new RedshiftClusterChecker(undefined)).toThrow(
        "redshiftClusterIdentifier can't be empty"
      );
    });

    it('should throw an error if redshiftClusterIdentifier is an empty string', () => {
      expect(() => new RedshiftClusterChecker('')).toThrow(
        "redshiftClusterIdentifier can't be empty"
      );
    });

    it('should throw an error if redshiftClusterIdentifier contains only whitespace', () => {
      expect(() => new RedshiftClusterChecker('   ')).toThrow(
        "redshiftClusterIdentifier can't be empty"
      );
    });

    it('should create an instance successfully with a valid identifier', () => {
      const checker = new RedshiftClusterChecker(CLUSTER_IDENTIFIER);
      expect(checker).toBeInstanceOf(RedshiftClusterChecker);
      // Verify that the RedshiftClient was instantiated.
      expect(RedshiftClient).toHaveBeenCalledTimes(1);
    });
  });

  // --- isAvailable Method Tests ---

  describe('isAvailable', () => {
    it('should return true if the cluster status is "available"', async () => {
      // Arrange: Mock the AWS SDK response for an available cluster.
      mockSend.mockResolvedValue({
        Clusters: [
          {
            ClusterIdentifier: CLUSTER_IDENTIFIER,
            ClusterStatus: 'available',
          },
        ],
      });

      // Act
      const checker = new RedshiftClusterChecker(CLUSTER_IDENTIFIER);
      const isAvailable = await checker.isAvailable();

      // Assert
      expect(isAvailable).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(DescribeClustersCommand).toHaveBeenCalledWith({ ClusterIdentifier: CLUSTER_IDENTIFIER });
    });

    it('should return false if the cluster status is not "available"', async () => {
      // Arrange: Mock the response for a cluster in a "creating" state.
      mockSend.mockResolvedValue({
        Clusters: [
          {
            ClusterIdentifier: CLUSTER_IDENTIFIER,
            ClusterStatus: 'creating',
          },
        ],
      });

      // Act
      const checker = new RedshiftClusterChecker(CLUSTER_IDENTIFIER);
      const isAvailable = await checker.isAvailable();

      // Assert
      expect(isAvailable).toBe(false);
    });

    it('should throw an error if the cluster does not exist (empty Clusters array)', async () => {
      // Arrange: Mock the response for a non-existent cluster.
      mockSend.mockResolvedValue({
        Clusters: [],
      });
      
      const checker = new RedshiftClusterChecker(CLUSTER_IDENTIFIER);
      
      // Act & Assert: Check that the specific error is thrown.
      await expect(checker.isAvailable()).rejects.toThrow(
        `Cluster ${CLUSTER_IDENTIFIER} do not exists`
      );
    });

    it('should throw an error if the API response is malformed (no Clusters property)', async () => {
        // Arrange: Mock a response that is missing the 'Clusters' property.
        mockSend.mockResolvedValue({});

        const checker = new RedshiftClusterChecker(CLUSTER_IDENTIFIER);

        // Act & Assert
        await expect(checker.isAvailable()).rejects.toThrow(
            `Cluster ${CLUSTER_IDENTIFIER} do not exists`
        );
    });
    
    it('should propagate errors if the Redshift send command fails', async () => {
        // Arrange: Mock the send command to reject with an error.
        const awsError = new Error('AWS SDK error: Access Denied');
        mockSend.mockRejectedValue(awsError);

        const checker = new RedshiftClusterChecker(CLUSTER_IDENTIFIER);

        // Act & Assert: Ensure the original error is thrown by the method.
        await expect(checker.isAvailable()).rejects.toThrow(awsError);
    });
  });
});
