/** The engine's own writable view of a type that is readonly to everyone else. */
export type Mutable<Type> = { -readonly [Key in keyof Type]: Type[Key] };
