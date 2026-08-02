export const manualFixtureDefinitions = Object.freeze([
  Object.freeze({
    id: "clutter-symbol-regression",
    includeCloudSnapshot: false,
  }),
]);

export const manualFixtureIds = Object.freeze(manualFixtureDefinitions.map((definition) => definition.id));
