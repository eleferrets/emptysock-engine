---
"@emptysock/engine": minor
---

Add `compileVisualScriptGraph` and `CompiledVisualScriptComponent`, compiling a `VisualScriptGraph` to literal JS calls against `VariableStore`/`ActorSystem` instead of interpreting it node-by-node every frame. `VisualScriptComponent` (the interpreter) is unchanged and remains the default.
