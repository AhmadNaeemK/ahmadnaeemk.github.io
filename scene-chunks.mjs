/**
 * Why scene chunks may import only the chunk that imports them (section 8 of
 * docs/rfcs/theme-contract.md): a chunk that loads on demand and is shared makes
 * a failed scene unrecoverable in WebKit. If it fails alone, every scene that
 * imports it stays failed. If a scene chunk has any such dependency, Vite adds a
 * `modulepreload` link for that scene, and WebKit stops fetching it after a
 * failure. With no dependencies, a scene's dynamic import is a plain import.
 */
const SCENE_MODULE = /\/src\/themes\/[^/]+\/scene\.ts$/;

/**
 * The one scene every path to this module goes through, or null if none does.
 * Undefined means only modules already being visited import it, so they decide.
 */
function soleScene(id, chunking, visiting = new Set()) {
  if (SCENE_MODULE.test(id)) return id;
  if (visiting.has(id)) return undefined;
  visiting.add(id);

  const moduleInfo = chunking.getModuleInfo(id);
  if (!moduleInfo || moduleInfo.isEntry) return null;
  const owners = new Set(
    [...moduleInfo.importers, ...moduleInfo.dynamicImporters].map((importer) =>
      soleScene(importer, chunking, visiting),
    ),
  );
  owners.delete(undefined);
  if (owners.size === 0) return undefined;
  return owners.size === 1 ? [...owners][0] : null;
}

/**
 * One chunk for everything but entry scripts and what belongs to a single scene.
 * It holds the `import()` calls and loads with the page, so a scene's only
 * dependency has already loaded. Entry scripts stay out because they run on
 * import, and this chunk can be imported by another page's script.
 */
export const pageChunkGroup = {
  name(id, chunking) {
    const staysOut =
      chunking.getModuleInfo(id)?.isEntry || soleScene(id, chunking);
    return staysOut ? null : "page";
  },
};
