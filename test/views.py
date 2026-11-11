from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from cvat.apps.engine.models import Task, LabeledShape

class TaskAnnotationCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        # Check task access (Item 5 requirement)
        task = get_object_or_404(Task, pk=task_id)
        if not request.user.is_superuser and task.organization:
            if not task.organization.memberships.filter(user=request.user).exists():
                return Response({"detail": "You do not have permission to access this task."}, status=403)

        # Count annotations per label/class from LabeledShape
        shapes = LabeledShape.objects.filter(job__task_id=task_id)
        counts = {}
        for shape in shapes:
            label_name = shape.label.name if shape.label else "unknown"
            counts[label_name] = counts.get(label_name, 0) + 1

        return Response({
            "task_id": task_id,
            "annotation_counts": counts
        })