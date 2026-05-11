# Structure Exporter

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


