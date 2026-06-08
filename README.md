<p align="center">
  <img width="560" alt="Minecraft Builder Skill preview" src="https://github.com/user-attachments/assets/2bce3efe-68a4-4037-85c7-04435ebbf9e8" />
</p>

# minecraft-builder-skill

Give your agent Minecraft superpowers: it can design builds, generate JavaScript build recipes, export vanilla `.nbt` structures, and open interactive previews you can inspect before placing anything in-game.

## Requirements

- Node.js 20.19 or newer
- `npx`
- An agent that can load local skills

## Setup

Install it into your agent's skills directory:

```bash
npx --yes github:mattzh72/minecraft-builder-skill
```

Restart or reload your agent so it can discover the skill.

## Use

Ask your agent to use the installed skill:

```text
Use minecraft-builder-skill to make a floating crystal observatory, export the .nbt file, and open a night-mode preview.
```
