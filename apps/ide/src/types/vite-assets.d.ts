// Vite asset ?url import declarations
declare module '*.wasm?url' {
  const url: string;
  export default url;
}
