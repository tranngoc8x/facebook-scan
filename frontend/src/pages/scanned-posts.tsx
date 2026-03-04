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

interface Post {
    _id: string;
    content: string;
    authorName: string;
    status: string;
    matched: boolean;
    matchedRoomIds: string[];
    scannedAt: string;
    groupId?: { name: string };
}

interface Pagination {
    page: number;
    pages: number;
    total: number;
}

export default function ScannedPosts() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
    const [statusFilter, setStatusFilter] = useState("all");
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        async function loadPosts() {
            setLoading(true);
            const params = `page=${page}&limit=15${statusFilter !== "all" ? "&status=" + statusFilter : ""}`;
            const res = await api.getPosts(params);
            setPosts(res.data);
            setPagination(res.data.pagination || { page, pages: 1, total: res.data.length });
            setLoading(false);
        }
        loadPosts();
    }, [page, statusFilter]);

    function timeAgo(date: string) {
        if (!date) return "—";
        const diff = now - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            new: "outline",
            analyzed: "secondary",
            matched: "default",
            commented: "default",
            skipped: "outline",
        };
        return map[status] || "outline";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Scanned Posts</h1>
            </div>

            <div className="flex gap-3">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="analyzed">Analyzed</SelectItem>
                        <SelectItem value="matched">Matched</SelectItem>
                        <SelectItem value="commented">Commented</SelectItem>
                        <SelectItem value="skipped">Skipped</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-12 text-center text-muted-foreground">Loading...</div>
                    ) : posts.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">No posts found</div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Content</TableHead>
                                        <TableHead>Author</TableHead>
                                        <TableHead>Group</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Match</TableHead>
                                        <TableHead>Scanned</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {posts.map((post) => (
                                        <TableRow key={post._id}>
                                            <TableCell className="max-w-[280px] truncate text-sm">
                                                {post.content?.substring(0, 80)}
                                            </TableCell>
                                            <TableCell className="text-sm">{post.authorName || "—"}</TableCell>
                                            <TableCell className="text-sm">{post.groupId?.name || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {post.matched ? (
                                                    <Badge variant="default" className="bg-green-600">
                                                        Yes ({post.matchedRoomIds?.length || 0})
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">No</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {timeAgo(post.scannedAt)}
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
