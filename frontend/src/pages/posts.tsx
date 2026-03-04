import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Send, MapPin, Loader2, UploadCloud, X } from "lucide-react";
import { useAlert } from "@/components/alert-modal";
import * as api from "@/lib/api";

interface Room {
    _id: string;
    title: string;
    content: string;
    images: string[];
    location: string;
    locationKeywords: string[];
    hashtags: string[];
    price: number;
    isActive: boolean;
}

interface Group {
    _id: string;
    name: string;
}

interface RoomForm {
    title: string;
    content: string;
    location: string;
    locationKeywords: string;
    hashtags: string;
    price: string;
}

const defaultForm: RoomForm = {
    title: "",
    content: "",
    location: "",
    locationKeywords: "",
    hashtags: "",
    price: "",
};

export default function Posts() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [postOpen, setPostOpen] = useState(false);
    const [editing, setEditing] = useState<Room | null>(null);
    const [form, setForm] = useState<RoomForm>(defaultForm);
    const [files, setFiles] = useState<File[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const { showAlert, showConfirm } = useAlert();

    useEffect(() => {
        const loadData = async () => {
            const [roomsRes, groupsRes] = await Promise.all([api.getRooms(), api.getGroups()]);
            setRooms(roomsRes.data);
            setGroups(groupsRes.data);
            setLoading(false);
        };
        loadData();
    }, []);

    const reloadData = async () => {
        const [roomsRes, groupsRes] = await Promise.all([api.getRooms(), api.getGroups()]);
        setRooms(roomsRes.data);
        setGroups(groupsRes.data);
        setLoading(false);
    };

    function openCreate() {
        setEditing(null);
        setForm(defaultForm);
        setFiles([]);
        setOpen(true);
    }

    function openEdit(room: Room) {
        setEditing(room);
        setForm({
            title: room.title,
            content: room.content,
            location: room.location,
            locationKeywords: (room.locationKeywords || []).join(", "),
            hashtags: (room.hashtags || []).join(", "),
            price: room.price ? String(room.price) : "",
        });
        setFiles([]);
        setOpen(true);
    }

    async function handleSubmit() {
        const formData = new FormData();
        Object.entries(form).forEach(([k, v]) => formData.append(k, v));
        files.forEach((f) => formData.append("files", f));
        if (editing) {
            await api.updateRoom(editing._id, formData);
        } else {
            await api.createRoom(formData);
        }
        setOpen(false);
        reloadData();
    }

    async function handleDelete(id: string) {
        showConfirm("Ban co chac muon xoa bai dang nay?", async () => {
            await api.deleteRoom(id);
            reloadData();
        });
    }

    function openPostDialog(room: Room) {
        setSelectedRoom(room);
        setSelectedGroups([]);
        setPostOpen(true);
    }

    function toggleGroup(id: string) {
        setSelectedGroups((prev) =>
            prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
        );
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const updateFiles = (newFiles: File[]) => {
        setFiles(prev => {
            const combined = [...prev, ...newFiles];
            if (combined.length > 6) {
                showAlert("Chi cho phep toi da 6 anh/video cho 1 post.", "error");
                return combined.slice(0, 6);
            }
            return combined;
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
        updateFiles(droppedFiles);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
        updateFiles(selectedFiles);
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    async function handlePostToGroups() {
        if (!selectedRoom || selectedGroups.length === 0) return;
        setIsPosting(true);
        try {
            await api.postRoomToGroups(selectedRoom._id, selectedGroups);
            showAlert("Da yeu cau dang bai thanh cong!", "success");
            setPostOpen(false);
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const err = error as any;
            showAlert(err?.response?.data?.error || "Co loi xay ra khi yeu cau dang bai.", "error");
        } finally {
            setIsPosting(false);
        }
    }

    function formatPrice(price: number) {
        if (!price) return "";
        return new Intl.NumberFormat("vi-VN").format(price) + " VND/thang";
    }

    if (loading) {
        return <div className="text-center text-muted-foreground py-12">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Post Listings</h1>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Post
                </Button>
            </div>

            {rooms.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        No posts added yet
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room) => (
                        <Card key={room._id} className="flex flex-col">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-base leading-snug">{room.title}</CardTitle>
                                    <Badge variant={room.isActive ? "default" : "secondary"}>
                                        {room.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {room.location}
                                </div>
                                <div className="text-sm font-semibold text-green-500">
                                    {room.price > 0 ? formatPrice(room.price) : "N/A"}
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {room.content}
                                </p>
                                {room.hashtags?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {room.hashtags.map((tag, i) => (
                                            <Badge key={i} variant="outline" className="text-xs">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                            <Separator />
                            <CardFooter className="justify-between pt-3">
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(room)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(room._id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                                <Button size="sm" onClick={() => openPostDialog(room)}>
                                    <Send className="mr-2 h-3 w-3" />
                                    Post to Groups
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Post" : "Add New Post"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Content</Label>
                            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} />
                        </div>
                        <div className="space-y-2">
                            <Label>Location</Label>
                            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Quan 7, TP.HCM" />
                        </div>
                        <div className="space-y-2">
                            <Label>Hashtags (comma separated)</Label>
                            <Input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="#phongtro, #quangtri, #giare" />
                        </div>
                        <div className="space-y-2">
                            <Label>Price (VND/month)</Label>
                            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Images / Videos (Max 6)</Label>
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                                    }`}
                            >
                                <UploadCloud className="h-8 w-8 text-muted-foreground mb-4" />
                                <p className="text-sm font-medium mb-1">Drag & drop files here</p>
                                <p className="text-xs text-muted-foreground mb-4">Or click to select files (Images/Videos, max 6)</p>
                                <Input
                                    type="file"
                                    multiple
                                    accept="image/*,video/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <Label htmlFor="file-upload" className="cursor-pointer">
                                    <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                                        Select Files
                                    </Button>
                                </Label>
                            </div>
                            {files.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    {files.map((file, idx) => (
                                        <div key={idx} className="relative group border rounded-md p-1">
                                            <div className="aspect-square flex items-center justify-center bg-muted/30 overflow-hidden rounded">
                                                {file.type.startsWith("image/") ? (
                                                    <img src={URL.createObjectURL(file)} alt="" className="object-cover w-full h-full" />
                                                ) : (
                                                    <video src={URL.createObjectURL(file)} className="object-cover w-full h-full" />
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(idx)}
                                                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit}>{editing ? "Update" : "Save"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Post to Groups Dialog */}
            <Dialog open={postOpen} onOpenChange={setPostOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Post to Groups</DialogTitle>
                    </DialogHeader>
                    {selectedRoom && (
                        <div className="space-y-4">
                            <Card className="bg-muted/50">
                                <CardContent className="flex items-center gap-3 p-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background text-2xl">
                                        🏠
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">{selectedRoom.title}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> {selectedRoom.location}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Select Groups</Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            setSelectedGroups(
                                                selectedGroups.length === groups.length
                                                    ? []
                                                    : groups.map((g) => g._id)
                                            )
                                        }
                                    >
                                        {selectedGroups.length === groups.length ? "Deselect All" : "Select All"}
                                    </Button>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto rounded-md border p-1">
                                    {groups.map((group) => (
                                        <label
                                            key={group._id}
                                            className="flex items-center gap-3 rounded-sm px-3 py-2 hover:bg-accent cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedGroups.includes(group._id)}
                                                onChange={() => toggleGroup(group._id)}
                                                className="rounded"
                                            />
                                            <span className="text-sm">{group.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPostOpen(false)}>Cancel</Button>
                        <Button disabled={selectedGroups.length === 0 || isPosting} onClick={handlePostToGroups}>
                            {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            {isPosting ? "Posting..." : `Post Now (${selectedGroups.length})`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
