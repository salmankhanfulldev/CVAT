from django.urls import path
from .views import TaskAnnotationCountView

urlpatterns = [
    path('tasks/<int:task_id>/annotation-counts/', TaskAnnotationCountView.as_view(), name='task-annotation-counts'),
]
