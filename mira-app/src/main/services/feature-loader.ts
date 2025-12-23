/**
 * Feature Loader Service
 *
 * Handles loading, saving, and listing features from the project's
 * `.mira/features/{id}/feature.json` storage format.
 *
 * Implements Requirements:
 * - 9.1: Store features in `.mira/features/{id}/feature.json` format
 * - 9.2: Support loading, saving, and listing features for a project
 * - 9.4: Support feature metadata including title, description, status,
 *        branch name, model, and image paths
 *
 * @module feature-loader
 */

import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'

// ============================================================================
// Types
// ============================================================================

/**
 * Feature status values
 */
export type FeatureStatus =
  | 'backlog'
  | 'pending'
  | 'in_progress'
  | 'waiting_approval'
  | 'completed'
  | 'failed'

/**
 * Planning mode values
 */
export type PlanningMode = 'skip' | 'lite' | 'spec' | 'full'

/**
 * Plan spec status values
 */
export type PlanSpecStatus =
  | 'pending'
  | 'generating'
  | 'generated'
  | 'approved'
  | 'rejected'

/**
 * Parsed task status values
 */
export type ParsedTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'

/**
 * A parsed task from a plan specification
 */
export interface ParsedTask {
  /** Unique task identifier */
  id: string
  /** Task description */
  description: string
  /** Optional file path associated with the task */
  filePath?: string
  /** Optional phase grouping */
  phase?: string
  /** Task execution status */
  status: ParsedTaskStatus
}

/**
 * Plan specification for a feature
 */
export interface PlanSpec {
  /** Plan status */
  status: PlanSpecStatus
  /** Plan content (markdown) */
  content?: string
  /** Plan version number */
  version: number
  /** ISO 8601 timestamp when plan was generated */
  generatedAt?: string
  /** ISO 8601 timestamp when plan was approved */
  approvedAt?: string
  /** Parsed tasks from the plan */
  tasks?: ParsedTask[]
}

/**
 * Image path can be a simple string or an object with metadata
 */
export type ImagePath =
  | string
  | {
      path: string
      filename: string
      mimeType: string
    }

/**
 * Feature data structure
 */
export interface Feature {
  /** Unique feature identifier */
  id: string
  /** Feature title */
  title: string
  /** Feature description */
  description: string
  /** Feature status */
  status: FeatureStatus
  /** Git branch name for this feature */
  branchName?: string
  /** AI model to use for this feature */
  model?: string
  /** Image paths attached to this feature */
  imagePaths?: ImagePath[]
  /** Planning mode for this feature */
  planningMode?: PlanningMode
  /** Whether plan approval is required */
  requirePlanApproval?: boolean
  /** Plan specification */
  planSpec?: PlanSpec
  /** ISO 8601 timestamp of creation */
  createdAt: string
  /** ISO 8601 timestamp of last update */
  updatedAt: string
  /** Error message if feature failed */
  error?: string
  /** Summary of completed work */
  summary?: string
  /** ISO 8601 timestamp when execution started */
  startedAt?: string
}

/**
 * Options for creating a new feature
 */
export interface CreateFeatureOptions {
  /** Feature title */
  title: string
  /** Feature description */
  description: string
  /** Initial status (defaults to 'backlog') */
  status?: FeatureStatus
  /** Git branch name */
  branchName?: string
  /** AI model to use */
  model?: string
  /** Image paths */
  imagePaths?: ImagePath[]
  /** Planning mode */
  planningMode?: PlanningMode
  /** Whether plan approval is required */
  requirePlanApproval?: boolean
}

/**
 * Options for updating a feature
 */
export type UpdateFeatureOptions = Partial<Omit<Feature, 'id' | 'createdAt'>>

// ============================================================================
// Constants
// ============================================================================

/** Base directory name for mira data */
const MIRA_DIR = '.mira'

/** Features subdirectory name */
const FEATURES_DIR = 'features'

/** Feature JSON filename */
const FEATURE_JSON = 'feature.json'

/** Agent output filename */
const AGENT_OUTPUT_FILE = 'agent-output.md'

/** Images subdirectory name */
const IMAGES_DIR = 'images'

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get the mira directory for a project
 */
export function getMiraDir(projectPath: string): string {
  return path.join(projectPath, MIRA_DIR)
}

/**
 * Get the features directory for a project
 */
export function getFeaturesDir(projectPath: string): string {
  return path.join(getMiraDir(projectPath), FEATURES_DIR)
}

/**
 * Get the directory for a specific feature
 */
export function getFeatureDir(projectPath: string, featureId: string): string {
  return path.join(getFeaturesDir(projectPath), featureId)
}

/**
 * Get the feature.json path for a feature
 */
export function getFeatureJsonPath(
  projectPath: string,
  featureId: string
): string {
  return path.join(getFeatureDir(projectPath, featureId), FEATURE_JSON)
}

/**
 * Get the agent-output.md path for a feature
 */
export function getAgentOutputPath(
  projectPath: string,
  featureId: string
): string {
  return path.join(getFeatureDir(projectPath, featureId), AGENT_OUTPUT_FILE)
}

/**
 * Get the images directory for a feature
 */
export function getFeatureImagesDir(
  projectPath: string,
  featureId: string
): string {
  return path.join(getFeatureDir(projectPath, featureId), IMAGES_DIR)
}

/**
 * Ensure the mira directory structure exists
 */
export async function ensureMiraDir(projectPath: string): Promise<string> {
  const miraDir = getMiraDir(projectPath)
  await fsPromises.mkdir(miraDir, { recursive: true })
  return miraDir
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique feature ID
 */
export function generateFeatureId(): string {
  return `feature-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Check if a feature status is valid
 */
export function isValidFeatureStatus(status: string): status is FeatureStatus {
  return [
    'backlog',
    'pending',
    'in_progress',
    'waiting_approval',
    'completed',
    'failed',
  ].includes(status)
}

/**
 * Check if a planning mode is valid
 */
export function isValidPlanningMode(mode: string): mode is PlanningMode {
  return ['skip', 'lite', 'spec', 'full'].includes(mode)
}

// ============================================================================
// Feature Loader Class
// ============================================================================

/**
 * Feature Loader
 *
 * Handles persistence and retrieval of features from the file system.
 */
export class FeatureLoader {
  // ==========================================================================
  // Path Accessors
  // ==========================================================================

  /**
   * Get the features directory path for a project
   */
  getFeaturesDir(projectPath: string): string {
    return getFeaturesDir(projectPath)
  }

  /**
   * Get the directory path for a specific feature
   */
  getFeatureDir(projectPath: string, featureId: string): string {
    return getFeatureDir(projectPath, featureId)
  }

  /**
   * Get the feature.json path for a feature
   */
  getFeatureJsonPath(projectPath: string, featureId: string): string {
    return getFeatureJsonPath(projectPath, featureId)
  }

  /**
   * Get the agent-output.md path for a feature
   */
  getAgentOutputPath(projectPath: string, featureId: string): string {
    return getAgentOutputPath(projectPath, featureId)
  }

  /**
   * Get the images directory for a feature
   */
  getFeatureImagesDir(projectPath: string, featureId: string): string {
    return getFeatureImagesDir(projectPath, featureId)
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Load a feature by ID
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   * @returns The feature data or null if not found
   */
  async loadFeature(
    projectPath: string,
    featureId: string
  ): Promise<Feature | null> {
    try {
      const featureJsonPath = this.getFeatureJsonPath(projectPath, featureId)
      const content = await fsPromises.readFile(featureJsonPath, 'utf-8')
      const feature = JSON.parse(content) as Feature

      // Validate required fields
      if (!feature.id || !feature.title) {
        console.warn(
          `[FeatureLoader] Feature ${featureId} missing required fields`
        )
        return null
      }

      return feature
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      console.error(
        `[FeatureLoader] Failed to load feature ${featureId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Save a feature
   *
   * @param projectPath - The project root path
   * @param feature - The feature data to save
   * @returns The saved feature
   */
  async saveFeature(projectPath: string, feature: Feature): Promise<Feature> {
    // Ensure mira directory exists
    await ensureMiraDir(projectPath)

    // Ensure feature directory exists
    const featureDir = this.getFeatureDir(projectPath, feature.id)
    await fsPromises.mkdir(featureDir, { recursive: true })

    // Update timestamp
    feature.updatedAt = new Date().toISOString()

    // Write feature.json
    const featureJsonPath = this.getFeatureJsonPath(projectPath, feature.id)
    await fsPromises.writeFile(
      featureJsonPath,
      JSON.stringify(feature, null, 2),
      'utf-8'
    )

    console.log(`[FeatureLoader] Saved feature ${feature.id}`)
    return feature
  }

  /**
   * Create a new feature
   *
   * @param projectPath - The project root path
   * @param options - Feature creation options
   * @returns The created feature
   */
  async createFeature(
    projectPath: string,
    options: CreateFeatureOptions
  ): Promise<Feature> {
    const now = new Date().toISOString()
    const featureId = generateFeatureId()

    const feature: Feature = {
      id: featureId,
      title: options.title,
      description: options.description,
      status: options.status || 'backlog',
      branchName: options.branchName,
      model: options.model,
      imagePaths: options.imagePaths,
      planningMode: options.planningMode,
      requirePlanApproval: options.requirePlanApproval,
      createdAt: now,
      updatedAt: now,
    }

    return this.saveFeature(projectPath, feature)
  }

  /**
   * Update a feature
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   * @param updates - Fields to update
   * @returns The updated feature or null if not found
   */
  async updateFeature(
    projectPath: string,
    featureId: string,
    updates: UpdateFeatureOptions
  ): Promise<Feature | null> {
    const feature = await this.loadFeature(projectPath, featureId)
    if (!feature) {
      return null
    }

    // Apply updates
    const updatedFeature: Feature = {
      ...feature,
      ...updates,
      id: feature.id, // Ensure ID cannot be changed
      createdAt: feature.createdAt, // Ensure createdAt cannot be changed
      updatedAt: new Date().toISOString(),
    }

    return this.saveFeature(projectPath, updatedFeature)
  }

  /**
   * Delete a feature
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   * @returns true if deleted, false if not found
   */
  async deleteFeature(
    projectPath: string,
    featureId: string
  ): Promise<boolean> {
    try {
      const featureDir = this.getFeatureDir(projectPath, featureId)

      // Check if feature exists
      try {
        await fsPromises.access(featureDir)
      } catch {
        return false
      }

      // Delete the entire feature directory
      await fsPromises.rm(featureDir, { recursive: true, force: true })
      console.log(`[FeatureLoader] Deleted feature ${featureId}`)
      return true
    } catch (error) {
      console.error(
        `[FeatureLoader] Failed to delete feature ${featureId}:`,
        error
      )
      return false
    }
  }

  /**
   * List all features for a project
   *
   * @param projectPath - The project root path
   * @param options - Filter options
   * @returns Array of features
   */
  async listFeatures(
    projectPath: string,
    options?: {
      status?: FeatureStatus | FeatureStatus[]
    }
  ): Promise<Feature[]> {
    try {
      const featuresDir = this.getFeaturesDir(projectPath)

      // Check if features directory exists
      try {
        await fsPromises.access(featuresDir)
      } catch {
        return []
      }

      // Read all feature directories
      const entries = await fsPromises.readdir(featuresDir, {
        withFileTypes: true,
      })
      const featureDirs = entries.filter(entry => entry.isDirectory())

      // Load each feature
      const features: Feature[] = []
      for (const dir of featureDirs) {
        const featureId = dir.name
        const feature = await this.loadFeature(projectPath, featureId)

        if (!feature) continue

        // Filter by status if specified
        if (options?.status) {
          const statusFilter = Array.isArray(options.status)
            ? options.status
            : [options.status]
          if (!statusFilter.includes(feature.status)) {
            continue
          }
        }

        features.push(feature)
      }

      // Sort by creation time (feature IDs contain timestamp)
      features.sort((a, b) => {
        const aTime = a.createdAt
          ? new Date(a.createdAt).getTime()
          : parseInt(a.id.split('-')[1] || '0', 10)
        const bTime = b.createdAt
          ? new Date(b.createdAt).getTime()
          : parseInt(b.id.split('-')[1] || '0', 10)
        return aTime - bTime
      })

      return features
    } catch (error) {
      console.error('[FeatureLoader] Failed to list features:', error)
      return []
    }
  }

  // ==========================================================================
  // Agent Output Operations
  // ==========================================================================

  /**
   * Get agent output for a feature
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   * @returns The agent output content or null if not found
   */
  async getAgentOutput(
    projectPath: string,
    featureId: string
  ): Promise<string | null> {
    try {
      const agentOutputPath = this.getAgentOutputPath(projectPath, featureId)
      const content = await fsPromises.readFile(agentOutputPath, 'utf-8')
      return content
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      console.error(
        `[FeatureLoader] Failed to get agent output for ${featureId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Save agent output for a feature
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   * @param content - The agent output content
   */
  async saveAgentOutput(
    projectPath: string,
    featureId: string,
    content: string
  ): Promise<void> {
    // Ensure feature directory exists
    const featureDir = this.getFeatureDir(projectPath, featureId)
    await fsPromises.mkdir(featureDir, { recursive: true })

    const agentOutputPath = this.getAgentOutputPath(projectPath, featureId)
    await fsPromises.writeFile(agentOutputPath, content, 'utf-8')
    console.log(`[FeatureLoader] Saved agent output for ${featureId}`)
  }

  /**
   * Append to agent output for a feature
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   * @param content - The content to append
   */
  async appendAgentOutput(
    projectPath: string,
    featureId: string,
    content: string
  ): Promise<void> {
    // Ensure feature directory exists
    const featureDir = this.getFeatureDir(projectPath, featureId)
    await fsPromises.mkdir(featureDir, { recursive: true })

    const agentOutputPath = this.getAgentOutputPath(projectPath, featureId)
    await fsPromises.appendFile(agentOutputPath, content, 'utf-8')
  }

  /**
   * Delete agent output for a feature
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   */
  async deleteAgentOutput(
    projectPath: string,
    featureId: string
  ): Promise<void> {
    try {
      const agentOutputPath = this.getAgentOutputPath(projectPath, featureId)
      await fsPromises.unlink(agentOutputPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  // ==========================================================================
  // Status Operations
  // ==========================================================================

  /**
   * Update feature status
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   * @param status - The new status
   * @returns The updated feature or null if not found
   */
  async updateStatus(
    projectPath: string,
    featureId: string,
    status: FeatureStatus
  ): Promise<Feature | null> {
    return this.updateFeature(projectPath, featureId, { status })
  }

  /**
   * Get features by status
   *
   * @param projectPath - The project root path
   * @param status - The status to filter by
   * @returns Array of features with the specified status
   */
  async getFeaturesByStatus(
    projectPath: string,
    status: FeatureStatus | FeatureStatus[]
  ): Promise<Feature[]> {
    return this.listFeatures(projectPath, { status })
  }

  /**
   * Get pending features (ready for execution)
   *
   * @param projectPath - The project root path
   * @returns Array of pending features
   */
  async getPendingFeatures(projectPath: string): Promise<Feature[]> {
    return this.getFeaturesByStatus(projectPath, 'pending')
  }

  /**
   * Get in-progress features
   *
   * @param projectPath - The project root path
   * @returns Array of in-progress features
   */
  async getInProgressFeatures(projectPath: string): Promise<Feature[]> {
    return this.getFeaturesByStatus(projectPath, 'in_progress')
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if a feature exists
   *
   * @param projectPath - The project root path
   * @param featureId - The feature ID
   * @returns true if the feature exists
   */
  async featureExists(
    projectPath: string,
    featureId: string
  ): Promise<boolean> {
    try {
      const featureJsonPath = this.getFeatureJsonPath(projectPath, featureId)
      await fsPromises.access(featureJsonPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get feature count
   *
   * @param projectPath - The project root path
   * @param options - Filter options
   * @returns The number of features
   */
  async getFeatureCount(
    projectPath: string,
    options?: {
      status?: FeatureStatus | FeatureStatus[]
    }
  ): Promise<number> {
    const features = await this.listFeatures(projectPath, options)
    return features.length
  }

  /**
   * Generate a unique feature ID
   */
  generateFeatureId(): string {
    return generateFeatureId()
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Default feature loader instance */
export const featureLoader = new FeatureLoader()
