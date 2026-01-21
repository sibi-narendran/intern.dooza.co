"""
Service Layer for Dooza API

Business logic layer that sits between routers and database.
Handles validation, state machines, and complex operations.
"""

from app.services.task_service import TaskService

__all__ = ["TaskService"]
