# Release Notes v0.1.3

## Core Interface Overhaul

This release introduces a significant redesign of the management interface, focusing on usage transparency and operational auditability.

### Activity Dashboard
- Replaced basic analytics with a high-fidelity activity monitoring system.
- Interactive metric cards for Spend, Requests, and Token usage.
- Real-time hover synchronization: chart interaction dynamically updates card totals and breakdown lists.
- Integrated 365-day activity heatmap for long-term usage pattern visualization.
- Advanced timeframe selection with 17 predefined ranges including rolling windows and calendar periods.

### Request Audit Logging
- Dedicated Logs interface with Generations and Sessions tracking.
- Detailed request/response inspection with formatted JSON payloads.
- Live-streaming logs via Tauri event bus for real-time monitoring.
- High-density data table with performance metrics (tokens per second) and status tracking.
- Filtering by Spora Key and Model.

### UI/UX Refinements
- Increased default window dimensions to 1200x780 for better data density.
- Smooth transition animations and improved visual feedback on chart interaction.
- Sidebar navigation updated for intuitive access to Activity and Logs.

## Technical Improvements
- Optimized analytics API consumption for large datasets.
- Implemented robust timeframe resolution logic for consistent reporting.
- Enhanced TypeScript definitions for usage statistics and log payloads.
