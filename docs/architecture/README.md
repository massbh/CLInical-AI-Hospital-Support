# High Level Overview of system and implementation
**Warning: elements here may or may not be implemented in the project based on the stage of the project**

## Where does the system exist
The syste, eavesdrops on the conversation between the medical personel and the patient
```txt
                +------------------+
                |      SYSTEM      |
                +------------------+
                          |
                          v
                    +-----------+
                    |  WHISPER  |
                    +-----------+
                      ^       ^
                     /         \
                    /           \
        +-----------+           +-----------+
        |   PERSON 1| <-------> |  PERSON 2 |
        +-----------+           +-----------+
```

## High Level Overview - of the whole system
```mermaid
architecture-beta

    group web(server)[Web Platform]
        %% This is a so called access point from user side to the system
        %% it has backend (for calls with other parts of the system)
        %% and frontend with appointment generation system (dashboard and forms); conversation supporter UI; and done reports overview; 

        service appointment(server)[Appointment Form] in web
        service appointmentDashboard(server)[Appointment Dashboard] in web
        service realtime(server)[Realtime UI] in web
        service preview(server)[Report preview] in web
        service reportDashboard(server)[Report Dashboard] in web


    group medBrain(server)[Med Brain]
        %% Callable LLM running on Ollama
        service med(cloud)[Med LLM] in medBrain

        %% Validates the responses if they are in the correct format (Notes/Suggestions) 
        %% or if report parts are correct-ish
        service val(server)[Validator] in medBrain


    group ear(server)[Eavesdropper]

        service whisper(server)[Whisper] in ear
        service trans(disk)[Transcript] in ear
        service batcher(server)[Batching module] in ear
        service trad(server)[Trad LLM Gate] in ear


    group report(server)[Report Generator]

        service requester(server)[Requester] in report
        service generator(server)[PDF Generator] in report


    service email(server)[Emailing Service]

    service database(disk)[Database] 

    %% Flow of the Report START

        email:L -- R:reportDashboard

        reportDashboard:L -- R:preview
        preview:R -- R:generator
        generator:R -- R:requester
        requester:L -- R:val
        med:R -- L:val


    %% Eavesdropper flow

        whisper:R -- R:trans
        batcher:L -- R:trans
        batcher:L -- R:trad
        trad:L -- R:med %% here the question gets passed
        %%  med:R -- L:val is already drawn but this would be the flow
        val:L -- L:realtime


    %% Appointment Flow

        database:R -- R:appointment
        database:R -- R:requester
        database:L -- R:appointmentDashboard
        database:R -- R:reportDashboard
        database:R -- R:realtime
        database:R -- R:email

```

# 2. System Modules

## 2.1 Med Brain - Medically oriented support

- **Purpose:** Uses a Medically oriented LLM to send advice to the other modules.
- **Repo location:** [`../../medBrain`](../../medBrain)
- **Notes:** At the current stage of the project this module does not have system-wide auth and is not fully protected against unwanted LLM calls. Auth is implemented at the LLM Gate level only.

### 2.1.1 Sub-Components

- **Validator:** Uses a Medically oriented LLM to send advice to the other modules.
- **LLM Gate:** Instead of calling the Ollama endpoint this module will do the calling and validation of the request.

#### 2.1.1.1 Validator

Checks if response from an LLM fits a proper format or has correct data.

E.g blocks keywords like **as your AI asistant** or improper tag; something other than **Suggestion** or **Note**; since Med Brain handles also final report generation this will also validate the report secitons.

```mermaid
flowchart TD
    D[Receive LLM response]
    D --> E[Validate Response]
    E --> F{Valid?}
    F -- Yes --> G[Return validated response to user]
    F -- No --> H[Return error to the system]
```    

#### 2.1.1.2 LLM Gate

In between the Ollama endpoint and the rest of the system. Validates request from the other parts of the system.

Responsible for calling Ollama endpoint. Also holds the system prompt for the service.

```
flowchart TD
    A[Request] --> B[optional - Check Auth]
    B --> C[Check Request ]
    C --> D[Forward request to Validator with correct options]
    D --> E[Receive a validated response]
    E --> F[Return response to LLM Gate]
```

## 2.2 Eavesdropper - listens to the sympthoms

- **Purpose:** Transcribes the conversation and forms optimised questions to Med Brain
- **Repo location:** [`../../eavesdropper`](../../eavesdropper)
- **Notes:** This module lives close to the user (at least part of it) and tries to pick up as much information as possible form the conversation. For best results Whisper subcomponnent should hava an input microphone close to the user.

### 2.2.1 Sub-Components

**LOCAL**
- **Whisper:** Listens to the conversation and appends the Transript.
- **Transcript:** Whole conversation that constantly gets appended - most likely just a text file - will live on users device
- **Batching module:** Batches the conversation based on configs - by number of words or sentences.

**SERVER**
- **Trad LLM Gate:** Server-side gateway in `tradLlm` that receives batches, calls Ollama with a question-generation system prompt, and forms a question for Med LLM.

```
flowchart TD
    A[User Conversation] --> B[Whisper: Listen & Transcribe]
    B --> C[Append to Transcript]
    C --> D[Batching Module]
    D --> E[Create batch based on config: words/sentences]
    E --> F[Send batch to Trad LLM Gate]
```

#### 2.2.1.1 Whisper

Uses Whisper from Open AI to transcribe speach into text. [`https://github.com/openai/whisper`](official Whisper Repo)

#### 2.2.1.2 Transcript 

For now nothing more then just being a file

#### 2.2.1.3 Batching module: 

The system needs a short-term memory to store the last sent batch. It should split the transcript into two parts: `before batch` and `after batch`. Only the `after batch` is processed and counted, so it never sends the same data twice.

```mermaid
flowchart TD
    A[New Transcript Text Appended] --> B[Load Batching Config]
    B --> C[Load Last Processed Offset]

    C --> D[Split Transcript]
    D --> E[Before Batch: Already Processed]
    D --> F[After Batch: Unprocessed Portion]

    F --> G{Batch Type?}

    G -->|Character| H[Count Characters in After Batch]
    G -->|Word| I[Count Words in After Batch]
    G -->|Sentence| J[Count Sentences in After Batch]

    H --> K{Reached batch_size?}
    I --> K
    J --> K

    K -->|No| L[Wait for More Transcript Input]
    L --> A

    K -->|Yes| M[Create Batch from After Batch Portion]
    M --> N[Send Batch to Server]
    N --> O[Update Last Processed Offset]
    O --> A
```

#### 2.2.1.4 Trad LLM Gate

In between the existing batching module and Med LLM. It receives a batch string
or reads the next batch from the batching module endpoint, calls Ollama with a
question-generation system prompt, and returns one question string.

This service runs on the server for performance reasons and is implemented in
`tradLlm`, while the existing batching module remains in `eavesdropper` and is
not overwritten.

Implemented API:

| Endpoint | Purpose |
| --- | --- |
| `POST /question-generation` | Accepts a batch string and returns a generated question. |
| `POST /question-generation/from-batching` | Reads the next batch from the existing batching module and returns a generated question. |
| `GET /question-generation/batches` | Reads recent batches sent through this gate. |

```
flowchart TD
    A[Batching Module] --> B[Send batch string]
    B --> C[Trad LLM Gate]
    C --> D[Generated question]
    D --> E[Med LLM]
```

## 2.3 Report Generator - Generates the Report

- **Purpose:** Generates Report and prompts Med Brain for report sections
- **Repo location:** [`../../reportGenerator`](../../reportGenerator)
- **Notes:** Remember that flow is Requester > genrator (prev) > preview mode > generator (prod) > forward to the system

### 2.3.1 Sub-Components

- **Requester:** Handles the actuall part by part prompting of Med Brain to ensure correct flow. passes the Notes to the system and
- **PDF generator:** Has two modes preview without generating an actuall pdf just forwards the information to Report preview; and production generating the actuall report based on the edited/accepted preview report.
To test it run insert_test_data.py

#### 2.3.1.1 Requester

Gets all notes for this specific conversation that report has to be generated for and then generates an assessment --> then based on assesment geerates a Diagnosis --> then based on diagnosis the prescription. after this cycle has been completed returns all 3 parts to the PDF generator

```mermaid
flowchart TD
    B[Fetch All Notes for Conversation]

    B --> C[Generate Assessment from Notes]
    C --> D[Assessment Output]

    D --> E[Generate Diagnosis from Assessment]
    E --> F[Diagnosis Output]

    F --> G[Generate Prescription from Diagnosis]
    G --> H[Prescription Output]

    H --> I[Combine Assessment + Diagnosis + Prescription]
    I --> J[Return Parts to PDF Generator]
```

#### 2.3.1.2 PDF generator

| `report.preview` value | Meaning         | Action                                    |
| ---------------------- | --------------- | ----------------------------------------- |
| `null`                 | ready for Preview mode    | Send to Report Preview (no PDF generated) |
| `true`                 | ready for Production mode | Generate actual PDF                       |
| `false`                | Already sent    | Do nothing                                |

```mermaid
flowchart TD
    A[Start Scheduler] --> B[Wait 1 Hour]
    B --> C[Fetch Reports Needing Processing]

    C --> D{Any Reports Found?}
    D -->|No| B

    D -->|Yes| E[Select Next Report]
    E --> F[Check report.preview Flag]

    F -->|null| G[Preview Mode]
    G --> H[Forward Structured Report to Preview UI]
    H --> I[Leave preview Flag Unchanged]
    I --> J[Process Next Report]

    F -->|true| K[Production Mode]
    K --> L[Generate Final PDF]
    L --> M[Store PDF in Storage]
    M --> N[Update preview Flag to false]
    N --> J

    F -->|false| O[Already Sent]
    O --> J

    J --> P{More Reports?}
    P -->|Yes| E
    P -->|No| B

```

## 2.4 Emailing Service - Sends the emails with to the patients with the reports
**To decide on the meeting**

## 2.5 Web Platform - User access points and more

- **Purpose:** Handles UI and Backend the system. bulk of UI and UX
- **Repo location:** [`../../webPlatform`](../../webPlatform)
- **Notes:** Access point to the system handles the database connections and bulk of what user sees

### 2.5.1 Sub-Components

- **Realtime UI:** Displays Notes and Suggestions to the doctor/nurse to support the conversation

- **Report Preview:** Allows the personel to review the `singular` report based on what was genereted and forwards that information to the PDF Generator
- **Report Dashboard:** Dashboard allowing for seeing ALL of the report generated and those not generated - do not store PDFS sections are enough and we can always just build a pdf again if we have the text

- **Appointment Form:** Online Form for the end user allowing them to schedule the visit.
- **Appointment Dashboard:** Dashboard allowing the personel to trigger the system when appointment gets started as well as see where and when appointemnts take place with which doctors/nurses.


#### 2.5.1.2 Realtime UI

Streams notes and suggestions to the user. E.g left side reserved for notes right for suggestions
This way user knows what to ask the patient and where to lead the conversation to use the time as efficiently as possible.

```mermaid
flowchart TD
    A[Consultation Starts] --> B[Frontend Opens Realtime UI]

    B --> C[Subscribe to Notes Stream]
    B --> D[Subscribe to Suggestions Stream]

    C --> E[Display Notes on Left Panel]
    D --> F[Display Suggestions on Right Panel]

    E --> G[Live Update as New Notes Arrive]
    F --> H[Live Update as New Suggestions Arrive]

    G --> G
    H --> H
```

#### 2.5.1.2 Report Preview

Screen used for Preview of the singluar report. Not a PDF editor just a Text editor. Allows the personel to make changes or just accept the genereted report. Swithces the flag in the database to `true` to finalize the report in the next cycle.

```mermaid
flowchart TD
    A[Open Report Preview Page] --> B[Fetch Structured Report Data]

    B --> C[Display Assessment + Diagnosis + Prescription]

    C --> D{User Action}

    D -->|Edit| E[Modify Report Text]
    E --> C

    D -->|Accept| F[Update report.preview to true]
    F --> G[Save Changes to Database]
    G --> H[Wait for Next PDF Generation Cycle]
```

#### 2.5.1.3 Report Dashboard

Allows the personel to see all Reports and filter the by title patient or generation date. or status.

```mermaid
flowchart TD
    A[Open Report Dashboard] --> B[Fetch All Reports from Database]

    B --> C[Display Report List]

    C --> D{Apply Filters?}

    D -->|Yes| E[Filter by Title / Patient / Date / Status]
    E --> C

    D -->|No| F[Select Report]
    F --> G[Open Report Preview]
```

#### 2.5.1.3 Appointment Form

Allows the patient to book an appoitmnet with a date picking functionality and prefered time.

```mermaid
flowchart TD
    A[Patient Opens Appointment Form] --> B[Select Date]

    B --> C[Select Preferred Time]
    C --> D[Enter Required Information]

    D --> E[Submit Appointment Request]
    E --> F[Store Appointment in Database]
    F --> G[Confirmation Sent to Patient]
```

#### 2.5.1.4 Appointment Dashboard

Allows the personel to see all apoitments and tirgger the start of the system for a selected one.

```mermaid
flowchart TD
    A[Open Appointment Dashboard] --> B[Fetch All Appointments]

    B --> C[Display Appointment List]

    C --> D{Select Appointment?}

    D -->|No| C

    D -->|Yes| E[View Appointment Details]

    E --> F{Trigger System Start?}

    F -->|Yes| G[Activate Conversation Pipeline]
    G --> H[Update Appointment Status to Active]

    F -->|No| C
```

## 2.6 Database - Holds the data of the system
**Plan out the desing**

# 3. Possible Considerations

Should the nurse have access to the Report Preview screen? or do they not have the qualifications?
Should the system allow the personel to move the appointments in this project? and if so who can do it? and how do we notify the patient about the change or ask them for confirmation? - Maybe asking the patient to pick multiple dates and then rescheduling them to the next one is the way to go.



