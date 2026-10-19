# Requirements Document

## 1. Application Overview

### 1.1 Application Name
printOn24 Web Platform & Shopkeeper Admin Panel

### 1.2 Application Description
printOn24 is a web-based printing and shopkeeper management platform. This specification defines functional requirements for the end-to-end printing pipeline and PC management modules. It ensures independent document-level configuration isolation across multi-file orders (copies, page ranges, N-up layouts, paper sizes, color modes, duplex settings), full preview fidelity across the Software Panel, accurate Print Agent driver command dispatch, browser branding and favicon updates using the original logo, and complete lifecycle management for connected PC standees (enable/disable, set current PC, real-time heartbeat status, and deletion).

---

## 2. Users and Core Scenarios

### 2.1 Target Users
- **Shopkeeper / Counter Operator**: Reviews incoming multi-format customer orders, configures and previews document-specific or batch print settings, triggers physical printing via Print Agent / QZ Tray, and manages shop PC allocations.
- **Super Admin**: Controls shopkeeper permissions, licenses, and global PC allocation limits.
- **Customer**: Uploads single or multi-file orders (PDF, DOC/DOCX, Excel, PowerPoint, Images) with specific layout and copy requirements.

### 2.2 Core Scenarios
- **Multi-Document Order Processing**: An operator opens an order containing multiple documents with mixed formats and different configurations (e.g., PDF 1 with custom page range and multiple copies; PDF 2 with single page A3 single copy). Each document retains its independent settings without cross-contamination during preview and print dispatch.
- **N-up Layout Printing (1-in-1, 2-in-1, 4-in-1)**: An operator or customer selects an N-up layout; the setting persists across the pipeline and updates the preview without double-imposition at the driver stage.
- **Custom Page Range Configuration**: Selecting custom page ranges isolates the target pages and automatically locks related Print Type and Print Side options, unlocking them when custom page ranges are removed.
- **PC Fleet Management**: An operator manages registered PCs under QR & PC Management by enabling/disabling endpoints, assigning the active \"Current PC\", viewing online/offline statuses driven by agent heartbeats, and deleting obsolete PCs with safety confirmations.
- **Branding Assets**: Browser tabs, bookmarks, HTML metadata, and PWA manifests display the official original printOn24 logo.

---

## 3. Page Structure and Functional Specifications

### 3.1 Page Structure
```text
printOn24 Web Platform
├── 1. Public Portal & Authentication
│   ├── 1.1 Landing Page (/)
│   ├── 1.2 Login (/login)
│   └── 1.3 Forgot Password (/forgot-password)
└── 2. Shopkeeper Admin Panel
    ├── 2.1 Live Orders & Print Queue (/admin/orders)
    │   └── 2.1.1 Order Preview & Driver Properties View (/admin/orders/preview/:id)
    ├── 2.2 Dashboard (/admin/dashboard)
    ├── 2.3 Printer Configuration & Hardware (/admin/printers)
    ├── 2.4 Page Pricing Management (/admin/pricing)
    ├── 2.5 QR & PC Standee Management (/admin/qr-management)
    ├── 2.6 Reports & Settlement (/admin/settlements)
    ├── 2.7 Page Reminders (/admin/reminders)
    ├── 2.8 Shop Profile & Geolocation (/admin/profile)
    └── 2.9 Settings & Security (/admin/settings)
```

---

### 3.2 Functional Specifications

#### 1. System Branding & Metadata
- **Favicon & Icon Assets**: The platform uses the existing original printOn24 logo as the browser favicon, web app manifest icon, and standard HTML metadata icon across all public and admin views.

#### 2. Live Orders & Queue Management (`/admin/orders`)
- **Order Queue Display**: Displays active print orders scoped to the authenticated shop ID.
- **Multi-Document Support**: Supports orders containing multiple files of diverse types (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG).
- **Independent File Configuration Tracking**: Each uploaded document within an order maintains a stable file identifier and an isolated configuration record storing:
  - Document Name and File Format
  - Copy Count (integer >= 1)
  - Selected Pages / Custom Page Range
  - Color Mode (`Black & White` / `Full Color`)
  - Paper Size (A4, A3, Legal, Letter, Custom)
  - Page Orientation (`Portrait` / `Landscape`)
  - Duplex Setting (`Single-Sided`, `Double-Sided Long Edge`, `Double-Sided Short Edge`)
  - N-up Layout (`1-in-1`, `2-in-1`, `4-in-1`)
- **Multi-Document Edit Selection**: When editing a multi-document order, the operator can choose an individual document or apply batch updates across 「All」 documents. Modifying one file must not mutate the stored configurations of other files in the order.

#### 3. Order Preview & Print Properties Configuration (`/admin/orders/preview/:id`)
- **Configuration Fidelity Preview**: The preview canvas reflects the exact effective output for the selected document:
  - Custom page ranges and total output sheet count.
  - Grayscale canvas rendering for `Black & White` and full color for `Full Color`.
  - Orientation (`Portrait` / `Landscape`) with correct aspect centering.
  - Target paper size ratio (A4, A3, etc.).
  - N-up imposition visualization (`1-in-1`, `2-in-1`, `4-in-1`) without double-imposing sheets.
  - Duplex indicator.
- **Custom Page Range Interaction Rules**:
  - Operators can specify exact page numbers and ranges (e.g., `1`, `1-5`, `2,4,6-8`).
  - When a Custom Page Range is active, the Print Type and Print Side configuration cards are automatically disabled.
  - Clearing the Custom Page Range restores interactivity to the Print Type and Print Side configuration cards.
- **Color Mode Controls**:
  - `Black & White` setting enforces monochrome rendering and monochrome driver commands.
  - `Full Color` setting retains color rendering and color driver commands.
  - Setting `Full Color` on a grayscale source document transmits a color driver command without modifying original content pixels.

#### 4. Hardware Driver & Print Agent Dispatch (`/admin/printers` & Print Agent)
- **Accurate Copy Execution**:
  - Copies must be executed strictly once at the target driver/agent level per document payload.
  - Application-level page loops and driver-level copy multipliers must not multiply together (preventing duplicate prints).
  - Retry mechanisms must preserve the exact original copy count.
- **Multi-Size Job Handling**:
  - Documents with different paper sizes (e.g., Doc 1 as A4, Doc 2 as A3) are automatically split into separate printer command streams if required by the target printer driver.
  - Hardware capabilities are validated before dispatch; unsupported paper sizes trigger explicit operator alerts.
- **Preserved N-up Execution**: N-up layout instructions are passed cleanly to avoid redundant imposition by both print engine and physical driver.

#### 5. QR & PC Standee Management (`/admin/qr-management`)
- **PC List Display**: Lists all registered shop PC endpoints, showing assigned name, hardware identifier, Current PC indicator, registration date, and status.
- **Enable / Disable Toggle**:
  - Each registered PC includes an Enable/Disable switch.
  - Disabled PCs are persisted in the database and immediately disqualified from receiving new print jobs, even if their Print Agent is online.
  - Re-enabling a PC restores its job assignment eligibility immediately.
- **Set Current PC**:
  - Allows setting one active PC as the \"Current PC\" for the shop.
  - The selection is persisted in the database and visually indicated in the list.
  - Only an enabled, online PC can be designated as the Current PC.
- **Online / Offline Status**:
  - Displays real-time status based on periodic heartbeat signals from the local Print Agent.
  - Automatically marks a PC as Offline when heartbeats cease past the timeout threshold.
- **Delete PC Functionality**:
  - Provides a Delete action for each registered PC with a confirmation prompt.
  - Deleting a PC removes its registration record from active device limits, enabling the shopkeeper to register a new PC within the Super Admin quota.
  - If the deleted PC was marked as \"Current PC\", the Current PC assignment is cleared.
  - Historical orders previously fulfilled by the deleted PC remain preserved in database logs.
- **Dynamic Add PC Permission**: The 「Add PC」 button enables dynamically when the registered active PC count is strictly below the Super Admin license limit, and disables when the limit is reached.

---

## 4. Business Rules and Core Logic

1. **Document Configuration Isolation**: Every document within an order must maintain its own state record referenced by unique file ID and common order ID. Global state mutations must never overwrite individual file settings.
2. **Zero Redundant Copy Multiplier**: The copy count must be set once per document print command payload to prevent exponential duplication.
3. **Single Imposition Rule**: N-up page imposition (`2-in-1`, `4-in-1`) must be performed once during pipeline document preparation and sent as pre-composed pages to the physical driver to prevent double-imposition.
4. **Custom Page Range Dependency**: An active Custom Page Range overrides and disables Print Type and Print Side options; removing the custom range restores default selectable states.
5. **Paper Size Driver Integrity**: When documents in an order target different paper sizes (e.g., A4 and A3), the system must generate matching driver payloads or split jobs per media size.
6. **PC Eligibility Rule**: Print jobs can only be dispatched to a PC that is simultaneously Enabled, Online, and designated as the Current PC.
7. **PC Deletion Integrity**: Deleting a PC decrements the active PC count against the shop license limit while maintaining relational integrity for past orders.
8. **Session Persistence**: Returning shopkeepers with valid tokens navigate directly to `/admin/orders` on root access.

---

## 5. Exceptions and Boundary Cases

| Scenario | Trigger Condition | System Behavior |
| :--- | :--- | :--- |
| **Mixed Copy Settings** | Order contains Doc 1 (Page 1 only, 2 copies) and Doc 2 (All pages, 1 copy) | Dispatches Doc 1 with 2 copies of Page 1, and Doc 2 with 1 copy of all pages; settings remain fully independent |
| **Mixed Paper Sizes** | Order contains both A4 and A3 documents sent to a single-tray printer | Alerts operator of tray incompatibility before dispatch, allowing tray or printer selection |
| **Disabled PC Print Attempt** | Dispatch triggered while designated Current PC is toggled to Disabled | Blocks dispatch with prompt requiring an enabled, online PC to be selected |
| **Agent Heartbeat Lost** | Print Agent disconnects or stops sending heartbeats | System updates PC status to Offline and prevents auto-dispatching new jobs to that endpoint |
| **Delete Current PC** | Operator deletes the PC currently marked as active | Prompts confirmation, deletes device registration, clears Current PC flag, and decrements registered PC count |
| **Custom Range Cleared** | Operator deletes values in Custom Page Range input | Preview updates to full document page count; Print Type and Print Side cards re-enable |
| **Print Job Retry** | Operator re-attempts a failed print job | Resends exact original copy count and document configurations without multiplying copies |

---

## 6. Acceptance Criteria

1. In a multi-file order, modifying copies, page ranges, paper size (A4/A3), color mode, orientation, duplex, or N-up settings on one file does not alter the configuration of any other file in that order.
2. An order containing multiple files with distinct copy counts prints each file with its exact specified copies without multiplier bugs on execution or retry.
3. Selecting `2-in-1` or `4-in-1` layout displays accurate multi-page imposition in the Software Panel preview and produces physical printouts without double-imposition.
4. Specifying a Custom Page Range disables Print Type and Print Side configuration cards; clearing the range re-enables them immediately.
5. The Software Panel preview accurately reflects all effective print parameters including page ranges, paper dimensions, orientation, grayscale/color, and N-up layouts.
6. Browser tab favicon, HTML metadata, and PWA manifest use the original printOn24 logo.
7. Operators can toggle PC records between Enabled and Disabled; Disabled PCs cannot receive print jobs.
8. Operators can designate an online, enabled PC as \"Current PC\", and real-time agent heartbeats accurately toggle Online/Offline status.
9. Operators can delete a registered PC with confirmation, which frees up the license slot for a new PC while preserving historical order logs.

---

## 7. Out of Scope for Current Release

- In-browser PDF text or vector editing.
- Direct customer portal checkout UI modifications.
- Automatic printer ink/toner level hardware telemetry.