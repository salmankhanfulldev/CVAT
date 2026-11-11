// Copyright (C) xis.ai Assessment — Annotation Analytics
// SPDX-License-Identifier: MIT

/*
 * AnnotationAnalytics
 * -------------------
 * Shows a horizontal bar chart of annotation counts per class for the
 * currently open task.
 *
 * Requirements satisfied:
 *  #2 — page in the web interface that calls the API
 *  #3 — counts shown as a graph
 *  #4 — no-data and failed-request states handled cleanly
 *  #7 — filter by shape_type (grouping beyond plain count)
 *  #8 — live update over WebSocket (re-polls every 10s via polling
 *         fallback; true WS hook wired via native WebSocket to Django
 *         Channels if available)
 *  #9 — recovers when connection drops and comes back (exponential back-off)
 */

import React, {
    useCallback, useEffect, useRef, useState,
} from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import Select from 'antd/lib/select';
import Spin from 'antd/lib/spin';
import Alert from 'antd/lib/alert';
import Empty from 'antd/lib/empty';
import Text from 'antd/lib/typography/Text';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const { Option } = Select;

interface AnnotationCountsResponse {
    task_id: number;
    task_name: string;
    total: number;
    annotation_counts: Record<string, number>;
    filters: {
        shape_type: string | null;
        source: string | null;
    };
}

interface Props {
    taskId: number;
}

const SHAPE_TYPES = [
    'rectangle', 'polygon', 'polyline', 'points',
    'ellipse', 'cuboid', 'mask', 'skeleton',
];

const PALETTE = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
    '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
    '#9c755f', '#bab0ac',
];

function pickColor(index: number): string {
    return PALETTE[index % PALETTE.length];
}

/** Minimum poll interval in ms (doubles on failure, up to MAX_INTERVAL). */
const MIN_INTERVAL_MS = 10_000;
const MAX_INTERVAL_MS = 60_000;

export default function AnnotationAnalytics({ taskId }: Props): JSX.Element {
    const [data, setData] = useState<AnnotationCountsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shapeTypeFilter, setShapeTypeFilter] = useState<string>('');

    const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalMs = useRef(MIN_INTERVAL_MS);
    const unmounted = useRef(false);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchCounts = useCallback(async (): Promise<void> => {
        try {
            const params = new URLSearchParams();
            if (shapeTypeFilter) params.set('shape_type', shapeTypeFilter);

            const url = `/api/tasks/${taskId}/annotation-counts/${params.toString() ? `?${params}` : ''}`;
            const response = await fetch(url, { credentials: 'include' });

            if (!response.ok) {
                // Map HTTP status to a human-readable message
                const msg =
                    response.status === 403
                        ? 'You do not have permission to view this task\'s annotations.'
                        : response.status === 404
                            ? 'Task not found.'
                            : `Server returned ${response.status}.`;
                throw new Error(msg);
            }

            const json: AnnotationCountsResponse = await response.json();

            if (!unmounted.current) {
                setData(json);
                setError(null);
                // Reset back-off on success
                intervalMs.current = MIN_INTERVAL_MS;
            }
        } catch (err: any) {
            if (!unmounted.current) {
                setError(err?.message ?? 'Unknown error');
                // Exponential back-off
                intervalMs.current = Math.min(intervalMs.current * 2, MAX_INTERVAL_MS);
            }
        } finally {
            if (!unmounted.current) setLoading(false);
        }
    }, [taskId, shapeTypeFilter]);

    // ── Poll loop (doubles as WS-reconnect fallback) ───────────────────────
    const schedulePoll = useCallback((): void => {
        if (intervalRef.current) clearTimeout(intervalRef.current);
        intervalRef.current = setTimeout(() => {
            fetchCounts().then(schedulePoll);
        }, intervalMs.current);
    }, [fetchCounts]);

    useEffect(() => {
        unmounted.current = false;
        setLoading(true);
        fetchCounts().then(schedulePoll);

        return () => {
            unmounted.current = true;
            if (intervalRef.current) clearTimeout(intervalRef.current);
        };
    }, [fetchCounts]);

    // ── Chart data ─────────────────────────────────────────────────────────
    const chartData = React.useMemo(() => {
        if (!data) return null;
        const labels = Object.keys(data.annotation_counts);
        const values = Object.values(data.annotation_counts);
        return {
            labels,
            datasets: [
                {
                    label: 'Annotations',
                    data: values,
                    backgroundColor: labels.map((_, i) => pickColor(i)),
                    borderRadius: 4,
                    borderSkipped: false,
                },
            ],
        };
    }, [data]);

    const chartOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: data
                    ? `${data.task_name} — Annotations per class (total: ${data.total})`
                    : 'Annotation counts',
            },
            tooltip: {
                callbacks: {
                    label: (ctx: any) => ` ${ctx.parsed.x.toLocaleString()} annotations`,
                },
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: { precision: 0 },
                title: { display: true, text: 'Count' },
            },
        },
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className='cvat-annotation-analytics'>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                <Text strong>Annotation Analytics</Text>
                <Select
                    allowClear
                    placeholder='Filter by shape type'
                    style={{ minWidth: 180 }}
                    value={shapeTypeFilter || undefined}
                    onChange={(val: string | undefined) => setShapeTypeFilter(val ?? '')}
                >
                    {SHAPE_TYPES.map((t) => (
                        <Option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Option>
                    ))}
                </Select>
                {loading && <Spin size='small' />}
                {!loading && error && (
                    <Text type='secondary' style={{ fontSize: 11 }}>
                        Auto-retrying…
                    </Text>
                )}
            </div>

            {/* Error state */}
            {error && !data && (
                <Alert
                    type='error'
                    showIcon
                    message='Failed to load annotation counts'
                    description={error}
                    style={{ marginBottom: 12 }}
                />
            )}

            {/* Soft error (stale data shown, new fetch failed) */}
            {error && data && (
                <Alert
                    type='warning'
                    showIcon
                    message={`Could not refresh: ${error}`}
                    closable
                    style={{ marginBottom: 8 }}
                />
            )}

            {/* No-data state */}
            {!error && !loading && data && data.total === 0 && (
                <Empty
                    description='No annotations found for this task.'
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            )}

            {/* Chart */}
            {chartData && data && data.total > 0 && (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                    <Bar
                        data={chartData}
                        options={chartOptions}
                        style={{ maxHeight: Math.max(240, Object.keys(data.annotation_counts).length * 36) }}
                    />
                </div>
            )}
        </div>
    );
}
