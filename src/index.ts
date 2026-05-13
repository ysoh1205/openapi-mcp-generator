#!/usr/bin/env node
/**
 * OpenAPI to MCP Generator
 *
 * This tool generates a Model Context Protocol (MCP) server from an OpenAPI specification.
 * It creates a Node.js project that implements MCP over stdio to proxy API requests.
 */
import fs from 'fs/promises';
import path from 'path';
import { Command } from 'commander';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';

// Import generators
import {
  generateMcpServerCode,
  generatePackageJson,
  generateTsconfigJson,
  generateGitignore,
  generateEslintConfig,
  generateJestConfig,
  generatePrettierConfig,
  generateEnvExample,
  generateOAuth2Docs,
  generateWebServerCode,
  generateTestClientHtml,
  generateStreamableHttpCode,
  generateStreamableHttpClientHtml,
} from './generator/index.js';

// Import types
import { CliOptions, TransportType } from './types/index.js';
import { normalizeBoolean } from './utils/helpers.js';
import pkg from '../package.json' with { type: 'json' };

// Export programmatic API
export { getToolsFromOpenApi, McpToolDefinition, GetToolsOptions } from './api.js';

// Configure CLI
const program = new Command();

program
  .name('openapi-mcp-generator')
  .description(
    'Generates a buildable MCP server project (TypeScript) from an OpenAPI specification'
  )
  .requiredOption(
    '-i, --input <file_or_url>',
    'Path or URL to the OpenAPI specification file (JSON or YAML)'
  )
  .requiredOption(
    '-o, --output <directory>',
    'Path to the directory where the MCP server project will be created (e.g., ./petstore-mcp)'
  )
  .option(
    '-n, --server-name <n>',
    'Name for the generated MCP server package (default: derived from OpenAPI info title)'
  )
  .option(
    '-v, --server-version <version>',
    'Version for the generated MCP server (default: derived from OpenAPI info version or 0.1.0)'
  )
  .option(
    '-b, --base-url <url>',
    'Base URL for the target API. Required if not specified in OpenAPI `servers` or if multiple servers exist.'
  )
  .option(
    '-t, --transport <type>',
    'Server transport type: "stdio", "web", or "streamable-http" (default: "stdio")'
  )
  .option(
    '-p, --port <number>',
    'Port for web or streamable-http transport (default: 3000)',
    (val) => parseInt(val, 10)
  )
  .option(
    '--default-include <boolean>',
    'Default behavior for x-mcp filtering (true|false, case-insensitive). Default: true (include by default), false = exclude by default',
    (val) => {
      const parsed = normalizeBoolean(val);
      if (typeof parsed === 'boolean') return parsed;
      console.warn(
        `Invalid value for --default-include: "${val}". Expected true/false (case-insensitive). Using default: true.`
      );
      return true;
    },
    true
  )
  .option('--force', 'Overwrite existing files without prompting')
  .version(pkg.version) // Match package.json version
  .action((options) => {
    runGenerator(options).catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
  });

// Export the program object for use in bin stub
export { program };

/**
 * Main function to run the generator
 */
async function runGenerator(options: CliOptions & { force?: boolean }) {
  // Use the parsed options directly
  const outputDir = options.output;
  const inputSpec = options.input;

  try {

    // Parse OpenAPI spec
    console.error(`Parsing OpenAPI spec: ${inputSpec}`);
    const api = (await SwaggerParser.dereference(inputSpec)) as OpenAPIV3.Document;
    console.error('OpenAPI spec parsed successfully.');

    // Determine server name and version
    const serverNameRaw = options.serverName || api.info?.title || 'my-mcp-server';
    const serverName = serverNameRaw.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const serverVersion = options.serverVersion || api.info?.version || '0.1.0';

    console.error('Generating server code...');
    const serverTsContent = generateMcpServerCode(api, options, serverName, serverVersion);

    const toolsPath = path.join(outputDir, "tools.json")
    await fs.writeFile(toolsPath, JSON.stringify(serverTsContent, null, 2), "utf-8")

    console.error('\n---');
    console.error(`MCP server project '${serverName}' successfully generated at: ${outputDir}`);
    console.error('\nNext steps:');
    console.error(`1. Navigate to the directory: cd ${outputDir}`);
    console.error(`2. Install dependencies: npm install`);

    if (options.transport === 'web') {
      console.error(`3. Build the TypeScript code: npm run build`);
      console.error(`4. Run the server in web mode: npm run start:web`);
      console.error(`   (This will start a web server on port ${options.port || 3000})`);
      console.error(`   Access the test client at: http://localhost:${options.port || 3000}`);
    } else if (options.transport === 'streamable-http') {
      console.error(`3. Build the TypeScript code: npm run build`);
      console.error(`4. Run the server in StreamableHTTP mode: npm run start:http`);
      console.error(`   (This will start a StreamableHTTP server on port ${options.port || 3000})`);
      console.error(`   Access the test client at: http://localhost:${options.port || 3000}`);
    } else {
      console.error(`3. Build the TypeScript code: npm run build`);
      console.error(`4. Run the server: npm start`);
      console.error(`   (This runs the built JavaScript code in build/index.js)`);
    }
    console.error('---');
  } catch (error) {
    console.error('\nError generating MCP server project:', error);

    // Only attempt cleanup if the directory exists and force option was used
    if (options.force) {
      try {
        await fs.rm(outputDir, { recursive: true, force: true });
        console.error(`Cleaned up partially created directory: ${outputDir}`);
      } catch (cleanupError) {
        console.error(`Failed to cleanup directory ${outputDir}:`, cleanupError);
      }
    }

    process.exit(1);
  }
}

// Export the run function for programmatic usage
export { runGenerator as generateMcpServer };
