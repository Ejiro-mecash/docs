import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(__dirname, "..");

// Define schemas for tool inputs
const DocsSearchSchema = z.object({
    query: z.string().describe("Search query to find in documentation files"),
});

const DocsGetPageSchema = z.object({
    path: z.string().describe("Relative path to the MDX file (e.g., 'quickstart.mdx')"),
});

const ApiGetEndpointSchema = z.object({
    path: z.string().describe("API endpoint path (e.g., '/v2/payouts')"),
    method: z.string().describe("HTTP method (e.g., 'post', 'get')"),
});

class MeCashDocsServer {
    constructor() {
        this.server = new Server(
            {
                name: "mecash-docs",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupTools();
    }

    setupTools() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "docs_search",
                        description: "Search through meCash documentation (MDX files) for specific topics or keywords.",
                        inputSchema: zodToJsonSchema(DocsSearchSchema),
                    },
                    {
                        name: "docs_get_page",
                        description: "Read the content of a specific meCash documentation page.",
                        inputSchema: zodToJsonSchema(DocsGetPageSchema),
                    },
                    {
                        name: "api_list_endpoints",
                        description: "List all available API endpoints from the meCash OpenAPI specification.",
                        inputSchema: { type: "object", properties: {} },
                    },
                    {
                        name: "api_get_endpoint",
                        description: "Get detailed information about a specific meCash API endpoint, including parameters and request/response schemas.",
                        inputSchema: zodToJsonSchema(ApiGetEndpointSchema),
                    },
                ],
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;

                switch (name) {
                    case "docs_search":
                        return await this.handleDocsSearch(args.query);
                    case "docs_get_page":
                        return await this.handleDocsGetPage(args.path);
                    case "api_list_endpoints":
                        return await this.handleApiListEndpoints();
                    case "api_get_endpoint":
                        return await this.handleApiGetEndpoint(args.path, args.method);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    async handleDocsSearch(query) {
        // Escape single quotes for grep
        const escapedQuery = query.replace(/'/g, "'\\''");
        try {
            // Find all mdx files containing the query
            // Using grep -r -l for file list and grep -r for context (limited)
            const { stdout } = await execAsync(`grep -r -i -l "${escapedQuery}" "${DOCS_ROOT}" --include="*.mdx" | head -n 10`);
            const files = stdout.split("\n").filter(Boolean);

            if (files.length === 0) {
                return {
                    content: [{ type: "text", text: "No results found." }],
                };
            }

            let results = "Found matches in the following files:\n\n";
            for (const file of files) {
                const relativePath = path.relative(DOCS_ROOT, file);
                results += `- ${relativePath}\n`;
            }

            return {
                content: [{ type: "text", text: results }],
            };
        } catch (error) {
            if (error.code === 1) { // grep returns 1 if no matches found
                return { content: [{ type: "text", text: "No results found." }] };
            }
            throw error;
        }
    }

    async handleDocsGetPage(pagePath) {
        // Prevent directory traversal
        const safePath = path.join(DOCS_ROOT, pagePath);
        if (!safePath.startsWith(DOCS_ROOT)) {
            throw new Error("Invalid path");
        }

        if (!await fs.pathExists(safePath)) {
            throw new Error(`File not found: ${pagePath}`);
        }

        const content = await fs.readFile(safePath, "utf-8");
        return {
            content: [{ type: "text", text: content }],
        };
    }

    async handleApiListEndpoints() {
        const openapiPath = path.join(DOCS_ROOT, "api-reference", "openapi.json");
        if (!await fs.pathExists(openapiPath)) {
            throw new Error("OpenAPI specification not found");
        }

        const spec = await fs.readJson(openapiPath);
        const endpoints = [];

        for (const [pathUrl, pathItem] of Object.entries(spec.paths)) {
            for (const [method, operation] of Object.entries(pathItem)) {
                if (["get", "post", "put", "delete", "patch"].includes(method.toLowerCase())) {
                    endpoints.push({
                        path: pathUrl,
                        method: method.toUpperCase(),
                        summary: operation.summary || "No summary available",
                        operationId: operation.operationId,
                    });
                }
            }
        }

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(endpoints, null, 2),
                },
            ],
        };
    }

    async handleApiGetEndpoint(targetPath, method) {
        const openapiPath = path.join(DOCS_ROOT, "api-reference", "openapi.json");
        if (!await fs.pathExists(openapiPath)) {
            throw new Error("OpenAPI specification not found");
        }

        const spec = await fs.readJson(openapiPath);
        const pathItem = spec.paths[targetPath];

        if (!pathItem) {
            throw new Error(`Path not found: ${targetPath}`);
        }

        const operation = pathItem[method.toLowerCase()];
        if (!operation) {
            throw new Error(`Method ${method} not found for path ${targetPath}`);
        }

        // Include components/schemas if needed for full context?
        // For simplicity, return the operation first.
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        path: targetPath,
                        method: method.toUpperCase(),
                        ...operation
                    }, null, 2),
                },
            ],
        };
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
}

const server = new MeCashDocsServer();
server.run().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
