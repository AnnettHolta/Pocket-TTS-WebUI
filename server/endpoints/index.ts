import { createApp } from "../app.ts";
import { registerPrepareLanguageEndpoint } from "./languages/[id]/prepare/endpoint.ts";
import { registerListLanguagesEndpoint } from "./languages/endpoint.ts";
import { registerLlmsEndpoint } from "./llms/endpoint.ts";
import { registerModelFileEndpoint } from "./models/pocket-tts/[revision]/[lang]/[file]/endpoint.ts";
import { registerDocsEndpoint } from "./v1/docs/endpoint.ts";
import { registerGenerateEndpoint } from "./v1/generate/endpoint.ts";

export const endpoints = createApp();

registerListLanguagesEndpoint(endpoints);
registerPrepareLanguageEndpoint(endpoints);
registerModelFileEndpoint(endpoints);
registerGenerateEndpoint(endpoints);
registerLlmsEndpoint(endpoints);

const specUrl = "/api/v1/openapi.json";
endpoints.doc(specUrl, {
  openapi: "3.0.3",
  info: { title: "PocketTTS Generation API", version: "1.0.0" },
});
registerDocsEndpoint(endpoints, specUrl);

endpoints.all("/api/*", (c) => c.json({ error: "API endpoint not found." }, 404));
