# Structure Exporter

[Browser Version](https://bt7s7k7.github.io/StructureExporter/)

Generates glTF models from Minecraft structure files. Compared with other competing solutions, this project focuses on simplicity and compatibility. No information about anything Minecraft related is included in the program, instead everything is read from Minecraft block state and model definitions, providing inherent compatibility with mods and resource packs. 

## Features

  - **Dynamic resource loading:** Compatibility with mods and resource packs
  - **Recursive structure support:** Compatibility with [Create](https://modrinth.com/mod/create) contraptions (including [Aeronautics](https://modrinth.com/mod/create-aeronautics))
  - **No native dependencies:** Written entirely in TypeScript, enabling running in browser
  - **Efficient materials:** All required textures are packed into one atlas, requiring only three materials to represent all blocks (opaque, alpha cutoff and alpha blended)
  - **Self-contained output:** Exported glTF model includes all the textures required for included blocks so it can be used directly without external files

## Limitations

  - **Block entity support:** No geometry created by block entity renderers is included (e.g. chest, beds, banners…)
  - **Face culling:** Without actual block information, face culling uses simple heuristics limited to full blocks
  - **Animated textures:** Animated textures are not supported, only the first frame is shown

> [!NOTE]
> Due to the use of a texture atlas, some engines may have problems with pixel bleeding at the edge the faces of the model (this also happens to affect the model preview in the web app). This is an error on their part that cannot be solved by this program. 

# Using the browser version

  1. **Import resources:** Drag and drop the client `.jar` and the `.jar` files of all mods used for the structure
  2. **Select structure:** Drag and drop the `.nbt` file of the structure you wish to build
  3. **Click build**

The resources are read from sources in alphabetical order. To ensure that resources overridden by resource packs or mods are prioritised over vanilla, rename the client `.jar` with a prefix like `zz-` to make sure it is last in the list.

The model preview uses the following control scheme: **Left button drag**: rotate camera; **Right button drag or Shift+Left button**: pan camera; **Middle button drag or Scroll wheel**: zoom in and out.

All resources, the input structure and the generate outputs are stored locally using the [Origin Private File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system). All processing is done in your browser and no data ever leaves your computer. Unlike the CLI, loaded resources are cached in memory for faster building of multiple structures using the same resource sources; there is no mechanism for cache eviction so reload the page if it takes too much memory.
