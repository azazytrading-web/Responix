# Project Glossary

| Term               | Definition                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Workspace          | The tenant-scoped unit in Responix that owns users, data, and activity.                                   |
| Tenant             | An isolated customer boundary; in the current foundation, a workspace is the tenant model.                |
| Company            | The organization operating or administering the Responix platform.                                        |
| Client             | A customer organization using Responix through its tenant workspace.                                      |
| Portal             | A scoped user-facing area for a client or role.                                                           |
| Conversation       | A sequence of messages between a customer, user, channel, and/or AI system.                               |
| Knowledge Base     | Tenant-scoped source material prepared for search and AI-assisted answers.                                |
| Workflow           | A defined sequence of triggers, conditions, and actions.                                                  |
| Workflow Engine    | The service that evaluates and executes workflows.                                                        |
| Agent              | A configured actor that can perform a bounded task.                                                       |
| AI Agent           | An agent that uses models, prompts, tools, memory, and policies to perform AI-assisted work.              |
| Provider           | An external AI platform or service that supplies model capabilities.                                      |
| Model Router       | The layer that selects or routes requests to an appropriate AI model/provider.                            |
| Prompt             | Structured instructions and context sent to an AI model.                                                  |
| Embedding          | A numeric representation of content used for semantic comparison.                                         |
| Vector Database    | A database capability used to store and search embeddings; PostgreSQL pgvector is the planned foundation. |
| CRM                | Customer relationship management functions such as customers, leads, deals, and activities.               |
| Dashboard          | A user interface for viewing and managing platform information.                                           |
| API                | The versioned HTTP interface exposed by the NestJS application.                                           |
| RAG                | Retrieval-augmented generation: retrieving relevant knowledge before an AI response is produced.          |
| Memory             | Persisted or session-scoped context used by an AI capability.                                             |
| Session            | A bounded authenticated or interaction context for a user, customer, or system process.                   |
| Company Dashboard  | The platform-operator dashboard for administration, monitoring, and control.                              |
| Client Dashboard   | The tenant-facing dashboard for client operations and data.                                               |
| Workspace Settings | Configuration scoped to one tenant workspace.                                                             |
| User               | A person account associated with a workspace in the current data foundation.                              |
| Role               | A named collection of permissions assigned to a user.                                                     |
| Permission         | A specific authorized capability.                                                                         |
| Subscription       | A commercial entitlement to a plan or service level.                                                      |
| Billing            | The processes for subscriptions, invoices, payments, renewals, quotas, and usage charging.                |
| Organization       | A business entity; use the more precise terms Company or Client/Workspace when the scope is known.        |
