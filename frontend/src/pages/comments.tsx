import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as api from "@/lib/api";

interface Comment {
    _id: string;
    content: string;
    status: string;
    postedAt: string | null;
    createdAt: string;
    error?: string;
    postId?: { content: string };
    roomId?: { title: string };
}

interface Pagination {
    page: number;
    pages: number;
    total: number;
}

export default function Comments() {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        loadComments();
    }, [page, statusFilter]);

    async function loadComments() {
        setLoading(true);
        const params = `page=${page}&limit=15${statusFilter !== "all" ? "&status=" + statusFilter : ""}`;
        const res = await api.getComments(params);
        setComments(res.data);
        setPagination(res.data.pagination || { page, pages: 1, total: res.data.length });
        setLoading(false);
    }

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

    const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            pending: "secondary",
            posted: "default",
            failed: "destructive",
        };
        return map[status] || "outline";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Comments</h1>
            </div>

            <div className="flex gap-3">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="posted">Posted</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-12 text-center text-muted-foreground">Loading...</div>
                    ) : comments.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">No comments yet</div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Comment</TableHead>
                                        <TableHead>Target Post</TableHead>
                                        <TableHead>Room</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {comments.map((comment) => (
                                        <TableRow key={comment._id}>
                                            <TableCell className="max-w-[300px] truncate text-sm">
                                                {comment.content?.substring(0, 80)}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-sm">
                                                {comment.postId?.content?.substring(0, 50) || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">{comment.roomId?.title || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(comment.status)}>{comment.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {timeAgo(comment.postedAt || comment.createdAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {pagination.pages > 1 && (
                                <div className="flex items-center justify-center gap-2 p-4 border-t">
                                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Page {page} of {pagination.pages}
                                    </span>
                                    <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
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
