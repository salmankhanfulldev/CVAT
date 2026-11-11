# Copyright (C) xis.ai Assessment — Annotation Analytics
# SPDX-License-Identifier: MIT

from django.urls import path
from .views import TaskAnnotationCountView

app_name = "annotation_analytics"

urlpatterns = [
    # Requirement 1: annotation counts per class for a task
    # GET /api/tasks/<task_id>/annotation-counts/
    # Optional query params: ?shape_type=rectangle  ?source=manual
    path(
        "tasks/<int:task_id>/annotation-counts/",
        TaskAnnotationCountView.as_view(),
        name="task-annotation-counts",
    ),
]
