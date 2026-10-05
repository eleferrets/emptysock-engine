// wgsl_reflect's package "main" is a broken CJS/ESM hybrid under Node; tests
// import the ESM build by path and reuse the package's own types.
declare module "wgsl_reflect/wgsl_reflect.module.js" {
  export * from "wgsl_reflect";
}
