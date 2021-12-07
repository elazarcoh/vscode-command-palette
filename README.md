# command-palette VSCode extension

This extension give you the ability to add commands to the Command Palette.

The only reason to use this extension is if you want to add an existing command, which is not available in the Command Palette, to the Command Palette.

It can be used, for example, with the [multi-command](https://marketplace.visualstudio.com/items?itemName=ryuta46.multi-command) extension.

## How to use

Add the following to your global ("User") settings:

```jsonc
"multiCommand.commands": [
    {
        "command": "multiCommand.down3Lines",
        "sequence": [
            "cursorDown",
            "cursorDown",
            "cursorDown"
        ]
    },
],
"command-palette.commands": [
    {
        "command": "extension.multiCommand.execute",
        "title": "Down 3 lines",
        "args": [
            {
                "command": "multiCommand.down3Lines"
            }
        ]
    }
]
```

* `command`: The command to add to the Command Palette.
* `title`: The title of the command.
* `category`: The category of the command. Optional.
* `when`: The condition to show the command. Optional.
* `args`: The arguments for the command. Optional.

When modifying the `command-palette.commands` setting, VSCode must be restarted for the changes to take effect.
A notification will be shown, asking to restart VSCode.
