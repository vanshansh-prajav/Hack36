import React, { useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
const Chat = () => {
    const modalRef = useRef(null);
    const [open, setOpen] = useState(false);
    const relocate = useNavigate();

    const handleClick = () => {
        if (open) {
            modalRef.current.close();
            setOpen(false);
        }
        else {
            modalRef.current.showModal();
            setOpen(true);
        }
    }

    const addUserHandler = () => {
        console.log("add user");
    }
    return (
        <div className='flex'>
            <button
                onClick={() => relocate('/home')}
                className='w-full py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition duration-300 disabled:opacity-50'
            >
                To home
            </button>

            <button onClick={handleClick} className='hover:border-2'>
                use me
            </button>

            <dialog
                ref={modalRef}
                className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 backdrop:bg-black/40 backdrop:backdrop-blur-sm p-6 rounded-xl shadow-2xl bg-gray-900 text-white w-full max-w-md"
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold">Add a Friend</h2>
                    <button
                        onClick={handleClick}
                        className="text-white text-xl px-3 py-1 rounded hover:bg-white/10 transition"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    <label className="flex flex-col text-left">
                        <span className="text-lg mb-1">Friend's Wallet Address or Username</span>
                        <input
                            type="text"
                            placeholder="0x123... or username"
                            className="p-3 rounded-md text-black bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </label>

                    <button
                        onClick={addUserHandler}
                        className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition"
                    >
                        Add Friend
                    </button>
                </div>
            </dialog>
        </div>

    )
}


export default Chat