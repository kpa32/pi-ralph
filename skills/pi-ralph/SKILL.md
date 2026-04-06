---
name: pi-ralph
description: Generate personalized greeting messages in multiple languages. Use when the user asks for greetings, welcome messages, or hello templates for emails, speeches, or informal communication.
---

# SayHello Skill

This skill provides structured greeting generation workflows for various languages and contexts.

## Usage

Load the skill on demand with `/skill:sayhello`, or the agent will auto-load it when greeting-related tasks match.

### Basic Greeting

Ask the model to use the `say_hello` tool or describe your greeting needs:

```
Please greet the engineering team in Japanese.
```

### Multi-Language Greeting Batch

When you need the same greeting in multiple languages, use this workflow:

1. Specify the name and list of target languages
2. The model will call `say_hello` for each language
3. Collect all results into a formatted greeting card

Example:

```
Generate greetings for "Alice" in English, Chinese, French, Spanish, Japanese, and German.
```

### Formal vs Informal

You can request formal or informal greeting styles:

```
Please generate a formal greeting for Mr. Tanaka in Japanese.
```

### Greeting Template Generation

The model can compose full greeting messages beyond just the hello phrase:

```
Write a friendly welcome email greeting for new team members joining the "Frontend Team".
```

## Available Languages

| Code | Language | Example |
|------|----------|---------|
| en   | English | Hello, World! |
| zh   | Chinese | World，你好！ |
| fr   | French | Bonjour, World! |
| es   | Spanish | ¡Hola, World! |
| ja   | Japanese | Worldさん、こんにちは！ |
| de   | German | Hallo, World! |

## Tool: say_hello

The extension registers a `say_hello` tool with parameters:
- `name` (required): The person or group to greet
- `language` (optional): Language code (en, zh, fr, es, ja, de)
