import { mdiDeleteOutline } from "@mdi/js"
import { defineComponent, PropType, renderSlot } from "vue"
import { Button } from "../vue3gui/Button"
import { TextField } from "../vue3gui/TextField"

export const FileList = (defineComponent({
    name: "FileList",
    props: {
        icon: { type: String, required: true },
        files: { type: Array as PropType<string[]>, required: true },
        placeholder: { type: String },
    },
    emits: {
        rename: (index: number, name: string) => true,
        delete: (index: number) => true,
    },
    setup(props, ctx) {
        return () => (
            <div class="border rounded flex column">
                {ctx.slots.default && (
                    <div class="border-bottom p-1 px-2">{renderSlot(ctx.slots, "default")}</div>
                )}
                <div class="flex-fill">
                    {props.files.length == 0 ? (
                        <div class="absolute-fill flex center">
                            <div class="muted flex-center p-2">{props.placeholder}</div>
                        </div>
                    ) : (
                        <div class="absolute-fill flex column scroll">
                            {props.files.map((file, i) => (
                                <div key={file} class="hover-check as-clickable flex row">
                                    <TextField class="flex-fill" explicit modelValue={file} onChange={(newName) => ctx.emit("rename", i, newName)} />
                                    <Button clear class="if-hover-fade" icon={mdiDeleteOutline} onClick={() => ctx.emit("delete", i)} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    },
}))
