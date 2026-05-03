import { withReactCompilerDevtools } from "@rcd/next-plugin";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withReactCompilerDevtools({
  compilerOptions: { compilationMode: "infer" },
})(config);
