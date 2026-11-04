/**
 * Shared harness for the scene runtime's specs. The page under test has no test
 * hooks: everything is seen through the contract's attributes, what the canvas
 * shows and spies on browser prototypes, so the specs do not depend on how a
 * theme draws or on which engine runs underneath it.
 */
export * from "./canvas-reads";
export * from "./canvas-texts";
export * from "./page-actions";
export * from "./routes";
export * from "./scene-spy";
export * from "./train";
