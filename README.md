# PSMDOC

<!-- Warning -->

## Warning

This project is under development and is not ready for production use. The documentation is incomplete and the features are not fully implemented.

## TODO

- [ ] Build mobile app command
- [ ] Internationalization support (Partial implemented)
- [ ] Search indexing
- [ ] Search functionality


 

## Prority Support Mobi DOCs

Priority support provide a easy versioned documentation system to be accessed and maintained by the support teams trough mobile devices and desktops applications.

## Features

- Versioned documentation
- Easy to use
- Mobile friendly, (Generate mobile app to read documentation offline)
- Desktop friendly (Generate desktop app to read documentation offline)
- Easy to maintain and update
- Easy to deploy and share

## How to use

Create a new folder for your documentation and add a MyPsmDoc.json file with the following structure:

```json
{
    "title": "My Documentation",
    "description": "This is a sample documentation",
    "keywords": "documentation, sample, example",
    "author": "John Doe",
    "robots": "index, follow",
    "auto-index": "true",
    "font": "https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap",
    "style": {
        "background": "#f5f5f5",
        "color": "#333",
        "font-family": "Roboto, sans-serif",
        "font-size": "16px",
        "line-height": "1.5",
        "text-align": "left"        
    },
    "languages": ["en", "fr", "de"],
    "version": "1.0.0"
}
```

Inital folder structure:

```bash
.
├── docs
│   ├── MyPsmDoc.json

```

The root folder will contain the documentation files and folders.

```bash
.
├── docs
│   ├── MyPsmDoc.json
│   ├── Home.psmdoc
│   ├── GettingStarted
│   │   ├── Introduction.psmdoc
│   │   ├── Installation.psmdoc
│   │   ├── Configuration.psmdoc
│   ├── UserGuide
│   │   ├── Login.psmdoc
│   │   ├── Dashboard.psmdoc
│   │   ├── Profile.psmdoc
│   ├── AdminGuide
│   │   ├── Users.psmdoc
│   │   ├── Roles.psmdoc
│   │   ├── Permissions.psmdoc
│   ├── DeveloperGuide
│   │   ├── Architecture.psmdoc
│   │   ├── Modules.psmdoc
│   ├── Support
│   │   ├── Contact.psmdoc

```


Add your documentation files with the .psmdoc extension. Use Folder names to create sections and sub-sections.

## .psmdoc file structure

All configurations and attributes are optional, a .psmdoc file can be as simple as a single line of text.

```markdown
Hello World!
```

Files are parsed in blocks, each block is separated by a blank line. Blocks can contain new lines inside them.
The following example shows a document with two blocks.

```markdown
Hello World!

This is a new block
that contains multiple lines
in it.
```

### Block attributes

#### Heading

Headings are defined by a single hash and the header level. The following example shows a document with three headings.

```markdown
#H1 Introduction

#H2 Getting Started
with PSMDOC

#H3 Installation
```

In the previous example, H2 constains many lines of text, but the parser will consider it as a single block. This is because the block is separated by a blank line. And usefull to create content in mobile devices for better reading.

#### Bold text

Bold text is defined by asterisks. The following example shows a document with bold text.

```markdown
*This is a bold text*

#H1 My Document is *awesome*
```

will render as:

**This is a bold text**

<h1>My Document is **awesome**</h1>

#### Italic text

Italic text is defined by underscores. The following example shows a document with italic text.

```markdown
_This is an italic text_

#H1 My Document is _awesome_
```

will render as:

_This is an italic text_

<h1>My Document is _awesome_</h1>

#### Lists

Lists are defined by a dash. The following example shows a document with a list.

```markdown
- Item 1
- Item 2
- Item *3*
```

will render as:

- Item 1
- Item 2
- Item *3*

#### Links

Are two types of links, internal and external links.

Internal links are lines that start with #IL followed by the link text and the file name. The file name must be the same as the file name.

```markdown
#IL /GettingStarted/Introduction.psmdoc "Getting Started" target="_blank"
```

External links are lines that start with #EL followed by the link text and the URL.

```markdown
#EL https://www.google.com Google target="_blank"
```

#### Images

Images are lines that start with #IMG followed by the image URL and the alt text.

```markdown
#IMG https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png "Google Logo" width="100" height="100" fit="cover"

```

#### Code

Code is defined by three backticks. The following example shows a document with code.

```markdown
```
function helloWorld() {
    console.log("Hello World!");
}
```
```

#### Tables

Tables are defined by a first line with #table Caption, and following lines with the table headers and rows.

```markdown
#table My Table
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1    | Row 1    | Row 1    |
| Row 2    | Row 2    | Row 2    |
| Row 3    | Row 3    | Row 3    |
```

#### Quotes

Quotes are defined by a #QUOTE tag. The following example shows a document with a quote.

```markdown
#QUOTE This is a quote
```





Multiple levels are not supported yet.

Set document attributes in the header of the file. If the first line starts with double hash ##, the parser will consider it as the header of the file.

```markdown
## title="Introduction to my documentation" label="Introduction"

```	


# Installation

## Requirements

- Node.js
- NPM

## Install

```bash
npm install -g @prioritysupport.mobi/psmdoc
```

# Usage

```bash

psmdoc mydoc_settings.json

```

# License

MIT







