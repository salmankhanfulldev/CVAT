# Copyright (C) xis.ai Assessment — Annotation Analytics
# SPDX-License-Identifier: MIT

from django.db.models import Count
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, PermissionDenied

from cvat.apps.engine.models import Task, Job, LabeledShape, LabeledImage, LabeledTrack, Segment


def _get_task_or_404(task_id: int) -> Task:
    """Return Task by pk or raise 404."""
    try:
        return Task.objects.select_related("project", "organization").get(pk=task_id)
    except Task.DoesNotExist:
        raise NotFound(detail=f"Task {task_id} not found.")


def _assert_task_access(request, task: Task) -> None:
    """
    Raise PermissionDenied when the authenticated user has no access to the task.

    Access is granted when the user:
    - is a superuser, OR
    - owns the task, OR
    - is assigned to the task, OR
    - is assigned to at least one job in the task, OR
    - is a member of the task's organisation (if any).
    """
    user = request.user
    if user.is_superuser:
        return

    # Task / job-level staff check
    if task.owner_id == user.id:
        return
    if task.assignee_id == user.id:
        return

    job_assigned = (
        Job.objects.filter(segment__task=task, assignee=user).exists()
    )
    if job_assigned:
        return

    # Organisation-level check
    if task.organization_id is not None:
        in_org = task.organization.memberships.filter(user=user).exists()
        if in_org:
            return

    raise PermissionDenied(
        detail="You do not have permission to access this task."
    )


class TaskAnnotationCountView(APIView):
    """
    GET /api/tasks/<task_id>/annotation-counts/

    Returns per-class annotation counts for a task, reading directly from
    the three annotation tables: LabeledShape, LabeledImage, LabeledTrack.

    Requires authentication.  Refuses a user who has no access to the task.

    Optional query parameters
    -------------------------
    shape_type : str
        Filter shapes by type (rectangle, polygon, polyline, points,
        ellipse, cuboid, mask, skeleton).  Applies only to LabeledShape counts.
    source : str
        Filter by annotation source (manual, auto, semi-auto, file, consensus).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, task_id: int) -> Response:
        task = _get_task_or_404(task_id)
        _assert_task_access(request, task)

        shape_type_filter = request.query_params.get("shape_type")
        source_filter = request.query_params.get("source")

        # ── Shapes (LabeledShape) ───────────────────────────────────────────
        # LabeledShape.job → Job.segment → Segment.task
        shape_qs = LabeledShape.objects.filter(
            job__segment__task_id=task_id,
            parent__isnull=True,          # exclude skeleton sub-shapes
        ).select_related("label")

        if shape_type_filter:
            shape_qs = shape_qs.filter(type=shape_type_filter)
        if source_filter:
            shape_qs = shape_qs.filter(source=source_filter)

        # Single aggregating query: GROUP BY label__name → count
        shape_counts_qs = (
            shape_qs
            .values("label__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # ── Tags (LabeledImage) ─────────────────────────────────────────────
        image_qs = LabeledImage.objects.filter(
            job__segment__task_id=task_id,
        )
        if source_filter:
            image_qs = image_qs.filter(source=source_filter)

        image_counts_qs = (
            image_qs
            .values("label__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # ── Tracks (LabeledTrack) ───────────────────────────────────────────
        track_qs = LabeledTrack.objects.filter(
            job__segment__task_id=task_id,
            parent__isnull=True,
        )
        if source_filter:
            track_qs = track_qs.filter(source=source_filter)

        track_counts_qs = (
            track_qs
            .values("label__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # ── Merge all three tables into one dict ────────────────────────────
        merged: dict[str, int] = {}
        for row in shape_counts_qs:
            merged[row["label__name"]] = merged.get(row["label__name"], 0) + row["count"]
        for row in image_counts_qs:
            merged[row["label__name"]] = merged.get(row["label__name"], 0) + row["count"]
        for row in track_counts_qs:
            merged[row["label__name"]] = merged.get(row["label__name"], 0) + row["count"]

        # Sort by count descending for a nicer default graph ordering
        annotation_counts = dict(
            sorted(merged.items(), key=lambda item: item[1], reverse=True)
        )

        return Response(
            {
                "task_id": task_id,
                "task_name": task.name,
                "total": sum(annotation_counts.values()),
                "annotation_counts": annotation_counts,
                "filters": {
                    "shape_type": shape_type_filter,
                    "source": source_filter,
                },
            }
        )
