import { getVercelOidcToken } from "@vercel/oidc";
import { VertexAI, type GenerateContentResponse, type Tool } from "@google-cloud/vertexai";
import { ExternalAccountClient } from "google-auth-library";

type GeminiModelOptions = {
  model: string;
  systemInstruction?: string;
  tools?: Tool[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
  };
};

const REQUIRED_ENV = [
  "GCP_PROJECT_ID",
  "GCP_PROJECT_NUMBER",
  "GCP_SERVICE_ACCOUNT_EMAIL",
  "GCP_WORKLOAD_IDENTITY_POOL_ID",
  "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
] as const;

function requireEnv(name: (typeof REQUIRED_ENV)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Vertex AI OIDC auth`);
  return value;
}

export function hasVertexOidcConfig(): boolean {
  return REQUIRED_ENV.every(name => Boolean(process.env[name]));
}

function createOidcAuthClient() {
  const projectNumber = requireEnv("GCP_PROJECT_NUMBER");
  const serviceAccountEmail = requireEnv("GCP_SERVICE_ACCOUNT_EMAIL");
  const workloadIdentityPoolId = requireEnv("GCP_WORKLOAD_IDENTITY_POOL_ID");
  const workloadIdentityPoolProviderId = requireEnv("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID");

  const authClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${workloadIdentityPoolId}/providers/${workloadIdentityPoolProviderId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: async () => getVercelOidcToken(),
    },
  });

  if (!authClient) {
    throw new Error("Failed to initialize Google external account client");
  }

  return authClient;
}

export function getVertexAI(): VertexAI {
  const project = requireEnv("GCP_PROJECT_ID");
  const location = process.env.GCP_LOCATION || "us-central1";
  const authClient = createOidcAuthClient();

  return new VertexAI({
    project,
    location,
    googleAuthOptions: {
      authClient,
      projectId: project,
    },
  });
}

export function getGeminiModel(options: GeminiModelOptions) {
  return getVertexAI().getGenerativeModel(options);
}

export function getVertexResponseText(response: GenerateContentResponse): string {
  return response.candidates?.[0]?.content?.parts
    ?.map(part => ("text" in part ? part.text : ""))
    .join("") || "";
}
