import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as api from "@/lib/api";

interface PostLogItem {
    _id: string;
    roomId: { _id: string; title: string; location: string; price: number } | null;
    groupId: { _id: string; name: string; url: string } | null;
    status: "success" | "failed";
    error: string;
    postedAt: string;
}

export default function PostHistory() {
    const [logs, setLogs] = useState<PostLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [statusFilter, setStatusFilter] = useState("all");

    const loadLogs = async () => {
        setLoading(true);
        const res = await api.getPostLogs(
            `page=${page}&limit=15${statusFilter === "all" ? "" : "&status=" + statusFilter}`,
        );
        setLogs(res.data);
        setPagination(res.data.pagination || { page, pages: 1, total: res.data.length });
        setLoading(false);
    };

    useEffect(() => {
        loadLogs();
    }, [page, statusFilter]);

    function timeAgo(date: string | null) {
        if (!date) return "—";
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    function formatDate(date: string) {
        return new Date(date).toLocaleString("vi-VN");
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Post History</h1>
                <span className="text-sm text-muted-foreground">
                    Total: {pagination.total} logs
                </span>
            </div>

            <div className="flex gap-3">
                <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                        setStatusFilter(v);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-12 text-center text-muted-foreground">Loading...</div>
                    ) : logs.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            No post history yet
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Post Title</TableHead>
                                        <TableHead>Group</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Error</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log._id}>
                                            <TableCell className="font-medium max-w-[200px] truncate">
                                                {log.roomId?.title || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.groupId ? (
                                                    <a
                                                        href={log.groupId.url}
                                                        target="_blank"
                                                        rel="noopener"
                                                        className="text-blue-500 hover:underline"
                                                    >
                                                        {log.groupId.name}
                                                    </a>
                                                ) : (
                                                    "—"
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        log.status === "success"
                                                            ? "default"
                                                            : "destructive"
                                                    }
                                                >
                                                    {log.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                                {log.error || "—"}
                                            </TableCell>
                                            <TableCell
                                                className="text-sm text-muted-foreground"
                                                title={formatDate(log.postedAt)}
                                            >
                                                {timeAgo(log.postedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {pagination.pages > 1 && (
                                <div className="flex items-center justify-center gap-2 p-4 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Page {page} of {pagination.pages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= pagination.pages}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
